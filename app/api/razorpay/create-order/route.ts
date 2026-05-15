// ============================================================
// FILE: app/api/razorpay/create-order/route.ts
// PURPOSE: Create Razorpay order using only server-validated amount from signed token
// LAST CHANGED: May 15, 2026
// WHY IT EXISTS: Handles Razorpay order creation for checkout payment flow
// DEPENDENCIES: razorpay npm package, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
//   ADMIN_JWT_SECRET (for HMAC token verification — must match validate-discount route)
// ⚠️ DO NOT CHANGE: NEVER accept a raw `amount` from the client anymore.
//   All amounts must come via a validationToken from /api/razorpay/validate-discount.
//   This is the core of the tamper-prevention system.
// ⚠️ DO NOT CHANGE: Token expiry check — do not remove or increase the 5-min TTL.
// ============================================================

// --- CHANGE LOG ---
// [May 15, 2026] CHANGED: No longer accepts raw `amount` from client
// REASON: Client could send any amount (e.g. 1 paise) and get a real Razorpay order.
//   Now requires a validationToken signed by /api/razorpay/validate-discount.
//   Amount is extracted from the verified token — client cannot influence it.
// --- END CHANGE LOG ---

import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { createHmac } from 'crypto'

// ─── HMAC token verification ──────────────────────────────────────────────────
// May 15, 2026 REASON: Must use the same secret + algorithm as validate-discount.
//   If someone tampers with the token data, the signature won't match → rejected.

function verifyAndDecodeToken(token: string): Record<string, any> | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [data, receivedSig] = parts

  const expectedSig = createHmac('sha256', process.env.ADMIN_JWT_SECRET!)
    .update(data)
    .digest('hex')

  // May 15, 2026 REASON: Timing-safe comparison — prevents timing attacks on HMAC
  // We compare lengths first (fast fail), then use a constant-time loop
  if (receivedSig.length !== expectedSig.length) return null
  let diff = 0
  for (let i = 0; i < expectedSig.length; i++) {
    diff |= receivedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i)
  }
  if (diff !== 0) return null

  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // ── 1. Require validationToken — reject raw amount ────────────────────────
    // May 15, 2026 REASON: This is the enforcement gate.
    //   Old code: const { amount, currency, country } = body  ← trusted client
    //   New code: amount comes ONLY from verified token payload
    const { validationToken } = body
    if (!validationToken || typeof validationToken !== 'string') {
      return NextResponse.json(
        { error: 'Missing validation token. Please restart checkout.' },
        { status: 400 }
      )
    }

    // ── 2. Verify HMAC signature ──────────────────────────────────────────────
    const payload = verifyAndDecodeToken(validationToken)
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or tampered validation token.' },
        { status: 400 }
      )
    }

    // ── 3. Check token expiry (5-minute TTL) ──────────────────────────────────
    // May 15, 2026 REASON: Prevents replay — if someone captures a token they
    //   cannot use it after 5 minutes. Also limits the price-lock window.
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
      return NextResponse.json(
        { error: 'Malformed token payload.' },
        { status: 400 }
      )
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
      // Return display values from token for the payment modal description
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
