// ============================================================
// FILE: app/api/razorpay/validate-discount/route.ts
// PURPOSE: Server-side discount + amount validation — returns HMAC-signed token
// LAST CHANGED: May 19, 2026
// WHY IT EXISTS: Prevent client-side price tampering. Server re-computes everything,
//   returns signed token. create-order only accepts that token — never a raw amount.
// DEPENDENCIES:
//   - lib/rateLimit.ts (rate limiting)
//   - lib/hmac.ts (signToken, TOKEN_TTL_MS)
//   - lib/shipping.ts (getShippingChargeINR)
//   - lib/coupon.ts (validateCoupon)
//   - Supabase service role (membership check, sale fetch, currency rates)
// ⚠️ DO NOT CHANGE: Reads peak_rate from currency_rates — NOT hardcoded rates.
// ⚠️ DO NOT CHANGE: Coupon disables sale+member entirely — it is the ONLY discount.
//   When couponResult is set, saleDiscount and memberDiscount are both ignored.
// ⚠️ DO NOT CHANGE: Highest-wins rule (Math.max) only applies when NO coupon is active.
// ⚠️ DO NOT CHANGE: membership uses boolean .eq('active', true)
// ⚠️ DO NOT CHANGE: maybeSingle() not single() — single() throws on no row
// ⚠️ DO NOT CHANGE: Coupon re-validated server-side here independently of client.
//   Client passes couponCode — server re-runs full validateCoupon() from scratch.
//   Never trust client-side coupon discount values.
// ============================================================

// --- CHANGE LOG ---
// [May 15, 2026] CREATED: Server-side discount enforcement
// REASON: Client was computing razorpayAmount itself — tamper risk.
// [May 15, 2026] UPDATED: Replaced hardcoded rates with Supabase peak_rate lookup
// [May 16, 2026] UPDATED: Migrated to shared lib/rateLimit.ts
// [May 16, 2026] UPDATED: Extracted signToken → lib/hmac.ts, shipping → lib/shipping.ts
// REASON: Modular architecture mandate — this file is now an orchestrator only.
// [May 19, 2026] UPDATED: Added coupon support via lib/coupon.ts
// REASON: Coupon system Tier 3 feature — coupon disables sale+member, honoured in shipping too.
// --- END CHANGE LOG ---

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit'
import { signToken, TOKEN_TTL_MS } from '@/lib/hmac'
import { getShippingChargeINR } from '@/lib/shipping'
import { validateCoupon } from '@/lib/coupon'

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

    const {
      items,
      currency: rawCurrency,
      country: rawCountry,
      // [May 19, 2026] REASON: Client passes coupon code if one is applied.
      //   Server re-validates independently — never trusts client discount values.
      couponCode,
    } = body as {
      items: CartItem[]
      currency: string
      country: string
      couponCode?: string | null
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

    // ── 7. Coupon validation (server-side, independent of client) ─────────────
    // [May 19, 2026] REASON: Compute raw subtotal first so validateCoupon can
    //   enforce min_order_usd against the undiscounted cart total.
    const rawSubtotalUSD = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )

    let couponResult: Awaited<ReturnType<typeof validateCoupon>> | null = null
    if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
      const result = await validateCoupon(couponCode.trim(), userId, isMember, rawSubtotalUSD)
      // [May 19, 2026] REASON: If coupon is invalid server-side (expired mid-session,
      //   just hit max uses, etc.) we silently ignore it and fall through to normal
      //   sale/member logic. Client will still show success but server corrects the amount.
      if (result.valid) couponResult = result
    }

    // ── 8. Compute discounted subtotal ────────────────────────────────────────
    let subtotalUSD           = 0
    let discountedSubtotalUSD = 0

    if (couponResult) {
      // [May 19, 2026] REASON: Coupon is active — it is the ONLY discount.
      //   Sale and member discounts are both ignored entirely.
      //   Per-item loop still needed for subtotalUSD (undiscounted base).
      subtotalUSD = rawSubtotalUSD

      if (couponResult.type === 'percent') {
        discountedSubtotalUSD = parseFloat(
          (subtotalUSD * (1 - couponResult.discountPercent / 100)).toFixed(2)
        )
      } else if (couponResult.type === 'fixed') {
        // [May 19, 2026] REASON: Cap at subtotal — never go negative.
        discountedSubtotalUSD = parseFloat(
          Math.max(0, subtotalUSD - couponResult.discountUSD).toFixed(2)
        )
      } else {
        // 'shipping' type — subtotal unchanged, free shipping handled in step 9
        discountedSubtotalUSD = subtotalUSD
      }
    } else {
      // [May 19, 2026] REASON: No coupon — normal per-item highest-wins logic
      //   (sale vs member discount, whichever is higher wins per item).
      for (const item of items) {
        const lineBaseUSD = item.price * item.quantity
        const saleDiscount = saleRow && isProductInSale(saleRow, item.id)
          ? saleRow.discount_percent
          : 0
        const effectiveDiscount = Math.max(saleDiscount, isMember ? 15 : 0)
        const lineDiscountedUSD = effectiveDiscount > 0
          ? lineBaseUSD * (1 - effectiveDiscount / 100)
          : lineBaseUSD

        subtotalUSD           += lineBaseUSD
        discountedSubtotalUSD += lineDiscountedUSD
      }
    }

    const savingsUSD = subtotalUSD - discountedSubtotalUSD

    // ── 9. Shipping via lib/shipping.ts ───────────────────────────────────────
    // [May 19, 2026] REASON: Coupon free shipping gives free shipping same as membership.
    //   Both flags checked — no conflict, just free either way.
    const shippingFree = isMember || (couponResult?.freeShipping ?? false)
    const shippingINR  = getShippingChargeINR(country, shippingFree)
    const shippingUSD  = shippingINR / peakRates['INR']

    // ── 10. Convert to payment currency ──────────────────────────────────────
    const targetRate     = peakRates[currency]
    const totalSmallest  = Math.round((discountedSubtotalUSD + shippingUSD) * targetRate * 100)

    if (totalSmallest < 100) {
      return NextResponse.json(
        { error: `Minimum order amount is 1 ${currency}` },
        { status: 400 }
      )
    }

    // ── 11. Sign token via lib/hmac.ts ────────────────────────────────────────
    const tokenPayload = {
      amount:                totalSmallest,
      currency,
      country,
      expiresAt:             Date.now() + TOKEN_TTL_MS,
      subtotalUSD:           Math.round(subtotalUSD * 100) / 100,
      discountedSubtotalUSD: Math.round(discountedSubtotalUSD * 100) / 100,
      savingsUSD:            Math.round(savingsUSD * 100) / 100,
      shippingINR,
      isMember,
      // [May 19, 2026] REASON: Coupon fields baked into signed token so create-order
      //   can record coupon details in the order without re-validating.
      couponId:              couponResult?.coupon?.id   ?? null,
      couponCode:            couponResult?.coupon?.code ?? null,
      couponType:            couponResult?.type         ?? null,
      freeShipping:          couponResult?.freeShipping ?? false,
      saleId:                couponResult ? null : (saleRow?.id   ?? null),
      saleName:              couponResult ? null : (saleRow?.name ?? null),
      peakRateUsed:          targetRate,
    }

    return NextResponse.json({
      validationToken:       signToken(tokenPayload),
      subtotalUSD:           tokenPayload.subtotalUSD,
      discountedSubtotalUSD: tokenPayload.discountedSubtotalUSD,
      savingsUSD:            tokenPayload.savingsUSD,
      shippingINR,
      totalSmallest,
      currency,
      isMember,
      // [May 19, 2026] REASON: Return coupon details so CheckoutForm can show
      //   the correct discount label and pass couponId to apply route post-payment.
      couponId:              tokenPayload.couponId,
      couponCode:            tokenPayload.couponCode,
      couponType:            tokenPayload.couponType,
      freeShipping:          tokenPayload.freeShipping,
      saleId:                tokenPayload.saleId,
      saleName:              tokenPayload.saleName,
      saleDiscount:          couponResult ? 0 : (saleRow?.discount_percent ?? 0),
      peakRateUsed:          targetRate,
    })

  } catch (err: any) {
    console.error('[validate-discount] error:', err?.message ?? err)
    return NextResponse.json({ error: 'Validation failed. Please try again.' }, { status: 500 })
  }
}
