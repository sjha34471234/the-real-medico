// ============================================================
// FILE: app/api/razorpay/create-order/route.ts
// PURPOSE: Creates Razorpay order using only server-validated amount from signed token.
//   Pure orchestration — verifies token via lib/hmac.ts, calls Razorpay, returns order.
// LAST CHANGED: May 17, 2026
// WHY IT EXISTS: Handles Razorpay order creation for checkout payment flow.
// DEPENDENCIES: lib/rateLimit.ts, lib/hmac.ts, razorpay npm package,
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, ADMIN_JWT_SECRET
// ⚠️ DO NOT CHANGE: NEVER accept a raw `amount` from the client.
//   All amounts must come via a validationToken from /api/razorpay/validate-discount.
//   This is the core of the tamper-prevention system.
// ⚠️ DO NOT CHANGE: Token expiry check — do not remove or increase the 5-min TTL.
// ⚠️ DO NOT CHANGE: Timing-safe HMAC comparison lives in lib/hmac.ts — do not inline it.
// ============================================================

// --- CHANGE LOG ---
// [May 15, 2026] CHANGED: No longer accepts raw `amount` from client
// REASON: Client could send any amount (e.g. 1 paise) and get a real Razorpay order.
//   Now requires a validationToken signed by /api/razorpay/validate-discount.
// [May 16, 2026] ADDED: Rate limiting via shared lib/rateLimit.ts
// REASON: Route had no rate limit — attacker could hammer it to burn Razorpay quota.
// [May 17, 2026] REFACTORED: HMAC verify extracted to lib/hmac.ts
// REASON: Modular architecture mandate. Route now imports verifyAndDecodeToken()
//   instead of owning the inline implementation.
// --- END CHANGE LOG ---

import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit'
import { verifyAndDecodeToken } from '@/lib/hmac'

export async function POST(req: Request) {
  // [May 16, 2026] REASON: Rate limit before any token processing —
  //   stops probing even before we touch the HMAC logic
  const ip = getClientIp(req)
  if (!checkRateLimit(ip, 'razorpayCreateOrder')) {
    return rateLimitResponse(RATE_LIMITS.razorpayCreateOrder.windowMs)
  }

  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // ── 1. Require validationToken — reject raw amount ────────────────────────
    // May 15, 2026 REASON: This is the enforcement gate.
    //   Old code trusted client-supplied amount. New code: amount comes ONLY from token.
    const { validationToken } = body
    if (!validationToken || typeof validationToken !== 'string') {
      return NextResponse.json(
        { error: 'Missing validation token. Please restart checkout.' },
        { status: 400 }
      )
    }

    // ── 2. Verify HMAC signature via lib/hmac.ts ──────────────────────────────
    const payload = verifyAndDecodeToken(validationToken)
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or tampered validation token.' },
        { status: 400 }
      )
    }

    // ── 3. Check token expiry (5-minute TTL) ──────────────────────────────────
    // May 15, 2026 REASON: Prevents replay attacks — token cannot be reused after 5 min.
    if (Date.now() > payload.expiresAt) {
      return NextResponse.json(
        { error: 'Validation token has expired. Please refresh your cart and try again.' },
        { status: 400 }
      )
    }

    // ── 4. Extract validated values from token ────────────────────────────────
    const { amount: totalSmallest, currency } = payload

    if (
      typeof totalSmallest !== 'number' ||
      totalSmallest < 100 ||
      typeof currency !== 'string'
    ) {
      return NextResponse.json({ error: 'Malformed token payload.' }, { status: 400 })
    }

    // ── 5. Create Razorpay order using only the token's amount ────────────────
    // May 15, 2026 REASON: amount comes from server-verified token — not client body
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    const order = await razorpay.orders.create({
      amount: totalSmallest,
      currency: currency,
      receipt: `trm_${Date.now()}`,
      notes: {
        // May 15, 2026 REASON: Store discount metadata in Razorpay order for reconciliation
        is_member:   String(payload.isMember  ?? false),
        sale_id:     String(payload.saleId    ?? ''),
        sale_name:   String(payload.saleName  ?? ''),
        savings_usd: String(payload.savingsUSD ?? 0),
        country:     String(payload.country   ?? ''),
      },
    })

    return NextResponse.json({
      order_id:        order.id,
      amount:          order.amount,
      currency:        order.currency,
      shipping:        payload.shippingINR          ?? 0,
      product_amount:  payload.discountedSubtotalUSD ?? 0,
      isMember:        payload.isMember             ?? false,
      saleName:        payload.saleName             ?? null,
      savingsUSD:      payload.savingsUSD            ?? 0,
    })

  } catch (error: any) {
    console.error('[create-order] error:', error?.error || error)
    return NextResponse.json(
      { error: error?.error?.description || 'Failed to create order' },
      { status: 500 }
    )
  }
}
