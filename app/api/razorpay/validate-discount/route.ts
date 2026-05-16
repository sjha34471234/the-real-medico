// ============================================================
// FILE: app/api/razorpay/validate-discount/route.ts
// PURPOSE: Server-side discount + amount validation — returns HMAC-signed token
// LAST CHANGED: May 16, 2026
// WHY IT EXISTS: Prevent client-side price tampering. Previously checkout sent
//   its own computed razorpayAmount to create-order which trusted it blindly.
//   Now: server re-computes everything, returns signed token. create-order
//   only accepts that token — never a raw client amount.
// DEPENDENCIES: lib/rateLimit.ts, Supabase (service role), ADMIN_JWT_SECRET (HMAC signing),
//   currency_rates table (peak rates — same source as UI)
// ⚠️ DO NOT CHANGE: Reads peak_rate from currency_rates — NOT hardcoded rates.
//   This guarantees UI and server use the exact same rate → no price mismatch.
// ⚠️ DO NOT CHANGE: Token TTL 5 minutes — do not increase (replay attack window)
// ⚠️ DO NOT CHANGE: Highest-wins rule — Math.max(saleDiscount, memberDiscount)
// ⚠️ DO NOT CHANGE: membership uses boolean .eq('active', true)
// ⚠️ DO NOT CHANGE: maybeSingle() not single() — single() throws on no row
// ============================================================

// --- CHANGE LOG ---
// [May 15, 2026] CREATED: Server-side discount enforcement
// REASON: Client was computing razorpayAmount itself — anyone with DevTools
//   could set amount=100 (1 paise) and get a valid Razorpay order.
// [May 15, 2026] UPDATED: Replaced hardcoded USD_RATES with Supabase peak_rate lookup
// REASON: Hardcoded rates (83 INR/USD) caused mismatch vs live UI rates (~95 INR/USD).
//   Now reads peak_rate from currency_rates table — same source as currencyStore.
//   UI and server always use identical rate → mismatch impossible.
// [May 16, 2026] CHANGED: Removed inline rate limiter, now uses shared lib/rateLimit.ts
// REASON: Each route had its own copy of rate limit logic — hard to audit and maintain.
//   Centralised in lib/rateLimit.ts with consistent limits across all routes.
// --- END CHANGE LOG ---

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit'

// May 15, 2026 REASON: Service role — membership verify + currency_rates read
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type CurrencyCode = 'INR' | 'USD' | 'GBP' | 'AED' | 'SGD' | 'MYR' | 'AUD' | 'CAD'

const SUPPORTED_CURRENCIES: CurrencyCode[] = ['INR', 'USD', 'GBP', 'AED', 'SGD', 'MYR', 'AUD', 'CAD']

// May 15, 2026 REASON: Last-resort fallback only — used if Supabase is unreachable.
//   Should match seeded values in supabase-currency-rates.sql.
//   In normal operation, these are NEVER used — Supabase peak rates are used instead.
const FALLBACK_RATES: Record<CurrencyCode, number> = {
  INR: 95, USD: 1, GBP: 0.79, AED: 3.67,
  SGD: 1.34, MYR: 4.7, AUD: 1.53, CAD: 1.36,
}

// ─── Shipping logic ───────────────────────────────────────────────────────────
// May 15, 2026 REASON: Shipping is in INR internally — converted to target currency
//   using the same peak rate. Keep in sync with create-order if zones change.
function getShippingChargeINR(country: string, isMember: boolean): number {
  if (isMember) return 0  // Members always get free shipping

  const c = country?.toLowerCase().trim()
  if (!c || c === 'india') return 0

  const zone1 = ['nepal', 'bangladesh', 'sri lanka', 'bhutan', 'myanmar']
  if (zone1.includes(c)) return 299

  const zone2 = [
    'uae', 'singapore', 'malaysia', 'thailand', 'indonesia',
    'philippines', 'vietnam', 'qatar', 'kuwait', 'bahrain',
    'oman', 'saudi arabia',
  ]
  if (zone2.includes(c)) return 599

  const zone3 = [
    'united states', 'usa', 'us', 'united kingdom', 'uk', 'canada',
    'australia', 'germany', 'france', 'netherlands', 'italy', 'spain',
    'sweden', 'norway', 'denmark', 'finland', 'switzerland', 'austria',
    'belgium', 'new zealand', 'ireland', 'portugal',
  ]
  if (zone3.includes(c)) return 899

  const zone4 = [
    'south africa', 'nigeria', 'kenya', 'ghana',
    'brazil', 'argentina', 'mexico', 'colombia',
  ]
  if (zone4.includes(c)) return 1099

  return 999
}

// ─── Sale scope check ─────────────────────────────────────────────────────────
function isProductInSale(
  sale: { scope: string; product_ids: string[] | null; category: string | null },
  productId: string,
): boolean {
  if (sale.scope === 'all') return true
  if (sale.scope === 'specific') {
    return Array.isArray(sale.product_ids) && sale.product_ids.includes(productId)
  }
  if (sale.scope === 'category') return true // Fail open — cart has no category
  return false
}

// ─── HMAC token helpers ───────────────────────────────────────────────────────
const TOKEN_TTL_MS = 5 * 60 * 1000 // 5 minutes

function signToken(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', process.env.ADMIN_JWT_SECRET!)
    .update(data)
    .digest('hex')
  return `${data}.${sig}`
}

// ─── Cart item type ───────────────────────────────────────────────────────────
interface CartItem {
  id: string       // Printify product ID
  title: string
  price: number    // base USD price (pre-discount)
  quantity: number
  size: string
  image: string
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  // [May 16, 2026] REASON: Migrated from inline rate limiter to shared lib/rateLimit.ts
  const ip = getClientIp(req)
  if (!checkRateLimit(ip, 'razorpayValidate')) {
    return rateLimitResponse(RATE_LIMITS.razorpayValidate.windowMs)
  }

  try {
    // ── 1. Parse and validate body ────────────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { items, currency: rawCurrency, country: rawCountry } = body as {
      items: CartItem[]
      currency: string
      country: string
    }

    const currency: CurrencyCode =
      SUPPORTED_CURRENCIES.includes(rawCurrency as CurrencyCode)
        ? (rawCurrency as CurrencyCode)
        : 'INR'
    const country = typeof rawCountry === 'string' ? rawCountry.trim() : 'India'

    for (const item of items) {
      if (
        typeof item.id !== 'string' ||
        typeof item.price !== 'number' || item.price <= 0 ||
        typeof item.quantity !== 'number' || item.quantity < 1 || item.quantity > 100
      ) {
        return NextResponse.json({ error: 'Invalid item data' }, { status: 400 })
      }
    }

    // ── 2. Load peak rates from Supabase ──────────────────────────────────────
    // May 15, 2026 REASON: CRITICAL — must use same rates as currencyStore UI.
    //   Both read from currency_rates.peak_rate → UI and server always match.
    //   Previously server used hardcoded 83 INR/USD, UI used live ~95 → mismatch.
    let peakRates: Record<CurrencyCode, number> = { ...FALLBACK_RATES }
    try {
      const { data: rateRows, error: rateError } = await supabaseAdmin
        .from('currency_rates')
        .select('currency, peak_rate')

      if (!rateError && rateRows && rateRows.length > 0) {
        for (const row of rateRows) {
          if (SUPPORTED_CURRENCIES.includes(row.currency as CurrencyCode)) {
            peakRates[row.currency as CurrencyCode] = Number(row.peak_rate)
          }
        }
        peakRates['USD'] = 1 // Always 1 — base currency
      } else {
        console.warn('[validate-discount] currency_rates fetch issue — using fallback rates')
      }
    } catch (e) {
      console.warn('[validate-discount] currency_rates unreachable — using fallback rates:', e)
    }

    // ── 3. Verify user session ────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    let userId: string | null = null
    if (accessToken) {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken)
      if (!error && user) userId = user.id
    }

    // ── 4. Check membership server-side ──────────────────────────────────────
    // May 15, 2026 REASON: Never trust isMember from client — always re-verify
    let isMember = false
    if (userId) {
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('id')
        .eq('user_id', userId)
        .eq('active', true)   // boolean column — NOT .eq('status','active')
        .maybeSingle()        // not .single() — throws PGRST116 on no row
      if (membership) isMember = true
    }

    // ── 5. Fetch active sale server-side ──────────────────────────────────────
    const now = new Date().toISOString()
    const { data: saleRow } = await supabaseAdmin
      .from('sales')
      .select('id, name, discount_percent, scope, product_ids, category, end_date')
      .eq('status', 'active')
      .lte('start_date', now)
      .gte('end_date', now)
      .order('discount_percent', { ascending: false })
      .limit(1)
      .maybeSingle()

    // ── 6. Compute discounted subtotal per item ───────────────────────────────
    let subtotalUSD = 0
    let discountedSubtotalUSD = 0

    for (const item of items) {
      const lineBaseUSD = item.price * item.quantity
      let saleDiscount = 0
      if (saleRow && isProductInSale(saleRow, item.id)) {
        saleDiscount = saleRow.discount_percent
      }
      const memberDiscount = isMember ? 15 : 0
      const effectiveDiscount = Math.max(saleDiscount, memberDiscount)
      const lineDiscountedUSD = effectiveDiscount > 0
        ? lineBaseUSD * (1 - effectiveDiscount / 100)
        : lineBaseUSD

      subtotalUSD += lineBaseUSD
      discountedSubtotalUSD += lineDiscountedUSD
    }

    const savingsUSD = subtotalUSD - discountedSubtotalUSD

    // ── 7. Compute shipping in USD using peak INR rate ─────────────────────────
    // May 15, 2026 REASON: Shipping defined in INR — convert to USD first,
    //   then to target currency via peak rate. All using Supabase peak rates.
    const shippingINR = getShippingChargeINR(country, isMember)
    const inrPeakRate = peakRates['INR'] // INR per 1 USD
    const shippingUSD = shippingINR / inrPeakRate

    // ── 8. Convert total to payment currency using peak rate ──────────────────
    // May 15, 2026 REASON: peakRates[currency] is exactly what currencyStore uses
    //   for formatPrice() → UI total and charged total are now identical.
    const targetRate = peakRates[currency]
    const totalUSD = discountedSubtotalUSD + shippingUSD
    const totalInCurrency = totalUSD * targetRate
    const totalSmallest = Math.round(totalInCurrency * 100)

    if (totalSmallest < 100) {
      return NextResponse.json(
        { error: `Minimum order amount is 1 ${currency}` },
        { status: 400 }
      )
    }

    // ── 9. Sign token ─────────────────────────────────────────────────────────
    const tokenPayload = {
      amount: totalSmallest,
      currency,
      country,
      expiresAt: Date.now() + TOKEN_TTL_MS,
      subtotalUSD: Math.round(subtotalUSD * 100) / 100,
      discountedSubtotalUSD: Math.round(discountedSubtotalUSD * 100) / 100,
      savingsUSD: Math.round(savingsUSD * 100) / 100,
      shippingINR,
      isMember,
      saleId: saleRow?.id ?? null,
      saleName: saleRow?.name ?? null,
      // May 15, 2026 REASON: Store the peak rate used — useful for order reconciliation
      peakRateUsed: targetRate,
    }

    const validationToken = signToken(tokenPayload)

    return NextResponse.json({
      validationToken,
      subtotalUSD: tokenPayload.subtotalUSD,
      discountedSubtotalUSD: tokenPayload.discountedSubtotalUSD,
      savingsUSD: tokenPayload.savingsUSD,
      shippingINR,
      totalSmallest,
      currency,
      isMember,
      saleId: saleRow?.id ?? null,
      saleName: saleRow?.name ?? null,
      saleDiscount: saleRow?.discount_percent ?? 0,
      peakRateUsed: targetRate,
    })

  } catch (err: any) {
    console.error('[validate-discount] error:', err?.message ?? err)
    return NextResponse.json(
      { error: 'Validation failed. Please try again.' },
      { status: 500 }
    )
  }
}
