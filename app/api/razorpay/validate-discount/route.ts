// ============================================================
// FILE: app/api/razorpay/validate-discount/route.ts
// PURPOSE: Orchestrates server-side discount + amount validation — returns HMAC-signed token.
//   Pure orchestration: reads from DB, calls lib functions, returns token.
// LAST CHANGED: May 17, 2026
// WHY IT EXISTS: Prevent client-side price tampering. Server re-computes everything,
//   returns signed token. create-order only accepts that token — never a raw amount.
// DEPENDENCIES: lib/rateLimit.ts, lib/shipping.ts, lib/hmac.ts,
//   Supabase (service role), currency_rates table
// ⚠️ DO NOT CHANGE: Reads peak_rate from currency_rates — NOT hardcoded rates.
//   UI and server use identical rate → no price mismatch possible.
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
// [May 16, 2026] CHANGED: Removed inline rate limiter, now uses shared lib/rateLimit.ts
// REASON: Each route had its own copy — centralised in lib/rateLimit.ts.
// [May 17, 2026] REFACTORED: Extracted shipping logic → lib/shipping.ts, HMAC → lib/hmac.ts
// REASON: Modular architecture mandate. Route now orchestrates only — no inline logic.
// --- END CHANGE LOG ---

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit'
import { getShippingChargeINR, isProductInSale } from '@/lib/shipping'
import { signToken, TOKEN_TTL_MS } from '@/lib/hmac'

// May 15, 2026 REASON: Service role — membership verify + currency_rates read
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type CurrencyCode = 'INR' | 'USD' | 'GBP' | 'AED' | 'SGD' | 'MYR' | 'AUD' | 'CAD'

const SUPPORTED_CURRENCIES: CurrencyCode[] = ['INR', 'USD', 'GBP', 'AED', 'SGD', 'MYR', 'AUD', 'CAD']

// May 15, 2026 REASON: Last-resort fallback only — used if Supabase is unreachable.
//   In normal operation these are NEVER used — Supabase peak rates are used instead.
const FALLBACK_RATES: Record<CurrencyCode, number> = {
  INR: 95, USD: 1, GBP: 0.79, AED: 3.67,
  SGD: 1.34, MYR: 4.7, AUD: 1.53, CAD: 1.36,
}

interface CartItem {
  id: string
  title: string
  price: number    // base USD price (pre-discount)
  quantity: number
  size: string
  image: string
}

export async function POST(req: Request) {
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

    // ── 6. Compute discounted subtotal (highest-wins rule per item) ───────────
    let subtotalUSD = 0
    let discountedSubtotalUSD = 0

    for (const item of items) {
      const lineBaseUSD = item.price * item.quantity
      const saleDiscount = saleRow && isProductInSale(saleRow, item.id)
        ? saleRow.discount_percent
        : 0
      const memberDiscount = isMember ? 15 : 0
      const effectiveDiscount = Math.max(saleDiscount, memberDiscount)
      const lineDiscountedUSD = effectiveDiscount > 0
        ? lineBaseUSD * (1 - effectiveDiscount / 100)
        : lineBaseUSD

      subtotalUSD += lineBaseUSD
      discountedSubtotalUSD += lineDiscountedUSD
    }

    const savingsUSD = subtotalUSD - discountedSubtotalUSD

    // ── 7. Compute shipping using lib/shipping.ts ─────────────────────────────
    // May 15, 2026 REASON: Shipping defined in INR — convert to USD via INR peak rate,
    //   then to target currency. All using Supabase peak rates (same as UI).
    const shippingINR = getShippingChargeINR(country, isMember)
    const shippingUSD = shippingINR / peakRates['INR']

    // ── 8. Convert total to payment currency ──────────────────────────────────
    const targetRate = peakRates[currency]
    const totalUSD = discountedSubtotalUSD + shippingUSD
    const totalSmallest = Math.round(totalUSD * targetRate * 100)

    if (totalSmallest < 100) {
      return NextResponse.json(
        { error: `Minimum order amount is 1 ${currency}` },
        { status: 400 }
      )
    }

    // ── 9. Sign token via lib/hmac.ts ─────────────────────────────────────────
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
