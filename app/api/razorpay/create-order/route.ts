// ============================================================
// FILE: app/api/razorpay/create-order/route.ts
// PURPOSE: Create Razorpay order using only server-validated amount from signed token
// LAST CHANGED: May 16, 2026
// WHY IT EXISTS: Handles Razorpay order creation for checkout payment flow.
//   Amount comes exclusively from a server-signed validation token — never from client.
// DEPENDENCIES:
//   - lib/rateLimit.ts (rate limiting)
//   - lib/hmac.ts (verifyAndDecodeToken)
//   - razorpay npm package
//   - RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
// ⚠️ DO NOT CHANGE: NEVER accept a raw `amount` from the client.
//   All amounts come via validationToken from /api/razorpay/validate-discount.
// ⚠️ DO NOT CHANGE: Token expiry check — do not remove or extend the TTL check.
// ============================================================

// --- CHANGE LOG ---
// [May 15, 2026] CHANGED: No longer accepts raw `amount` from client
// REASON: Client could send any amount and get a real Razorpay order.
// [May 16, 2026] ADDED: Rate limiting via shared lib/rateLimit.ts
// REASON: Route had no rate limit at all.
// [May 16, 2026] UPDATED: Extracted verifyAndDecodeToken → lib/hmac.ts
// REASON: Modular architecture mandate — HMAC logic lives in one place.
//   This file is now an orchestrator only.
// --- END CHANGE LOG ---

import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit'
import { verifyAndDecodeToken } from '@/lib/hmac'

export async function POST(req: Request) {
  // ── 1. Rate limit ─────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  if (!checkRateLimit(ip, 'razorpayCreateOrder')) {
    return rateLimitResponse(RATE_LIMITS.razorpayCreateOrder.windowMs)
  }

  try {
    // ── 2. Parse body ─────────────────────────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // ── 3. Require validationToken — reject raw amount ────────────────────────
    const { validationToken } = body
    if (!validationToken || typeof validationToken !== 'string') {
      return NextResponse.json(
        { error: 'Missing validation token. Please restart checkout.' },
        { status: 400 }
      )
    }

    // ── 4. Verify HMAC signature via lib/hmac.ts ──────────────────────────────
    const payload = verifyAndDecodeToken(validationToken)
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or tampered validation token.' },
        { status: 400 }
      )
    }

    // ── 5. Check token expiry ─────────────────────────────────────────────────
    // [May 15, 2026] REASON: 5-min TTL prevents replay attacks.
    //   Expiry is set in the payload by validate-discount using TOKEN_TTL_MS from lib/hmac.ts.
    if (Date.now() > payload.expiresAt) {
      return NextResponse.json(
        { error: 'Validation token expired. Please refresh your cart and try again.' },
        { status: 400 }
      )
    }

    // ── 6. Extract validated amount from token ────────────────────────────────
    const { amount: totalSmallest, currency } = payload

    if (typeof totalSmallest !== 'number' || totalSmallest < 100 || typeof currency !== 'string') {
      return NextResponse.json({ error: 'Malformed token payload.' }, { status: 400 })
    }

    // ── 7. Create Razorpay order ──────────────────────────────────────────────
    // [May 15, 2026] REASON: amount comes from verified token — never from client body
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    const order = await razorpay.orders.create({
      amount: totalSmallest,
      currency,
      receipt: `trm_${Date.now()}`,
      notes: {
        is_member: String(payload.isMember ?? false),
        sale_id: String(payload.saleId ?? ''),
        sale_name: String(payload.saleName ?? ''),
        savings_usd: String(payload.savingsUSD ?? 0),
        country: String(payload.country ?? ''),
      },
    })

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      shipping: payload.shippingINR ?? 0,
      product_amount: payload.discountedSubtotalUSD ?? 0,
      isMember: payload.isMember ?? false,
      saleName: payload.saleName ?? null,
      savingsUSD: payload.savingsUSD ?? 0,
    })

  } catch (error: any) {
    console.error('[create-order] error:', error?.error || error)
    return NextResponse.json(
      { error: error?.error?.description || 'Failed to create order' },
      { status: 500 }
    )
  }
}
