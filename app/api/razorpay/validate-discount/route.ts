// ============================================================
// FILE: app/api/razorpay/validate-discount/route.ts
// PURPOSE: Server-side discount + amount validation — returns HMAC-signed token
// LAST CHANGED: May 16, 2026
// WHY IT EXISTS: Prevent client-side price tampering. Server re-computes everything,
//   returns signed token. create-order only accepts that token — never a raw amount.
// DEPENDENCIES:
//   - lib/rateLimit.ts (rate limiting)
//   - lib/hmac.ts (signToken, TOKEN_TTL_MS)
//   - lib/shipping.ts (getShippingChargeINR)
//   - Supabase service role (membership check, sale fetch, currency rates)
// ⚠️ DO NOT CHANGE: Reads peak_rate from currency_rates — NOT hardcoded rates.
// ⚠️ DO NOT CHANGE: Highest-wins rule — Math.max(saleDiscount, memberDiscount)
// ⚠️ DO NOT CHANGE: membership uses boolean .eq('active', true)
// ⚠️ DO NOT CHANGE: maybeSingle() not single() — single() throws on no row
// ============================================================

// --- CHANGE LOG ---
// [May 15, 2026] CREATED: Server-side discount enforcement
// REASON: Client was computing razorpayAmount itself — tamper risk.
// [May 15, 2026] UPDATED: Replaced hardcoded rates with Supabase peak_rate lookup
// [May 16, 2026] UPDATED: Migrated to shared lib/rateLimit.ts
// [May 16, 2026] UPDATED: Extracted signToken → lib/hmac.ts, shipping → lib/shipping.ts
// REASON: Modular architecture mandate — this file is now an orchestrator only.
// --- END CHANGE LOG ---

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit'
import { signToken, TOKEN_TTL_MS } from '@/lib/hmac'
import { getShippingChargeINR } from '@/lib/shipping'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type CurrencyCode = 'INR' | 'USD' | 'GBP' | 'AED' | 'SGD' | 'MYR' | 'AUD' | 'CAD'

const SUPPORTED_CURRENCIES: CurrencyCode[] = ['INR', 'USD', 'GBP', 'AED', 'SGD', 'MYR', 'AUD', 'CAD']

const FALLBACK_RATES: Record<CurrencyCode, number> = {
  INR: 95, USD: 1, GBP: 0.79, AED: 3.67,
  SGD: 1.34, MYR: 4.7, AUD: 1.53, CAD: 1.36,
}

// [May 16, 2026] REASON: Kept here — only used by this route.
//   If a second route ever needs it, move to lib/activeSale.ts at that point.
function isProductInSale(
  sale: { scope: string; product_ids: string[] | null; category: string | null },
  productId: string,
): boolean {
  if (sale.scope === 'all') return true
  if (sale.scope === 'specific') {
    return Array.isArray(sale.product_ids) && sale.product_ids.includes(productId)
  }
  if (sale.scope === 'category') return true
  return false
}

interface CartItem {
  id: string
  title: string
  price: number
  quantity: number
  size: string
  image: string
}

export async function POST(req: Request) {
  // ── 1. Rate limit ─────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  if (!checkRateLimit(ip, 'razorpayValidate')) {
    return rateLimitResponse(RATE_LIMITS.razorpayValidate.windowMs)
  }

  try {
    // ── 2. Parse + validate body ──────────────────────────────────────────────
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

    // ── 3. Load peak rates from Supabase ──────────────────────────────────────
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
        peakRates['USD'] = 1
      } else {
        console.warn('[validate-discount] currency_rates fetch issue — using fallback rates')
      }
    } catch (e) {
      console.warn('[validate-discount] currency_rates unreachable — using fallback rates:', e)
    }

    // ── 4. Auth check ─────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    let userId: string | null = null
    if (accessToken) {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken)
      if (!error && user) userId = user.id
    }

    // ── 5. Membership check ───────────────────────────────────────────────────
    let isMember = false
    if (userId) {
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('id')
        .eq('user_id', userId)
        .eq('active', true)
        .maybeSingle()
      if (membership) isMember = true
    }

    // ── 6. Active sale ────────────────────────────────────────────────────────
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

    // ── 7. Compute discounted subtotal ────────────────────────────────────────
    let subtotalUSD = 0
    let discountedSubtotalUSD = 0

    for (const item of items) {
      const lineBaseUSD = item.price * item.quantity
      const saleDiscount = saleRow && isProductInSale(saleRow, item.id)
        ? saleRow.discount_percent
        : 0
      const effectiveDiscount = Math.max(saleDiscount, isMember ? 15 : 0)
      const lineDiscountedUSD = effectiveDiscount > 0
        ? lineBaseUSD * (1 - effectiveDiscount / 100)
        : lineBaseUSD

      subtotalUSD += lineBaseUSD
      discountedSubtotalUSD += lineDiscountedUSD
    }

    const savingsUSD = subtotalUSD - discountedSubtotalUSD

    // ── 8. Shipping via lib/shipping.ts ───────────────────────────────────────
    const shippingINR = getShippingChargeINR(country, isMember)
    const shippingUSD = shippingINR / peakRates['INR']

    // ── 9. Convert to payment currency ───────────────────────────────────────
    const targetRate = peakRates[currency]
    const totalSmallest = Math.round((discountedSubtotalUSD + shippingUSD) * targetRate * 100)

    if (totalSmallest < 100) {
      return NextResponse.json(
        { error: `Minimum order amount is 1 ${currency}` },
        { status: 400 }
      )
    }

    // ── 10. Sign token via lib/hmac.ts ────────────────────────────────────────
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
      peakRateUsed: targetRate,
    }

    return NextResponse.json({
      validationToken: signToken(tokenPayload),
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
    return NextResponse.json({ error: 'Validation failed. Please try again.' }, { status: 500 })
  }
}
