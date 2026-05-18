// ============================================================
// FILE: app/api/coupon/apply/route.ts
// PURPOSE: Records a coupon use after payment is confirmed.
//   Rate limit → auth → applyCoupon() → return.
//   Orchestration only. All logic in lib/coupon.ts.
// LAST CHANGED: May 19, 2026
// WHY IT EXISTS: Called by client AFTER Razorpay verify succeeds.
//   Writes coupon_uses row + increments uses counter.
// DEPENDENCIES: lib/coupon.ts, lib/rateLimit.ts
// ⚠️ DO NOT CHANGE: Requires Authorization: Bearer header — user must be logged in.
//   No auth = 401, not a soft error. Coupon use must be tied to a real user.
// ⚠️ DO NOT CHANGE: Call this AFTER /api/razorpay/verify succeeds — not before.
//   Applying before verify means a failed payment still burns the coupon.
// ============================================================

// --- CHANGE LOG ---
// [May 19, 2026] CREATED: New route for recording coupon use post-payment
// REASON: Coupon system Tier 3 feature.
// --- END CHANGE LOG ---

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit'
import { applyCoupon } from '@/lib/coupon'

export async function POST(req: NextRequest) {
  // ── 1. Rate limit ─────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  if (!checkRateLimit(ip, 'couponApply')) {
    return rateLimitResponse(RATE_LIMITS.couponApply.windowMs)
  }

  // ── 2. Parse + validate body ──────────────────────────────────────────────
  const body = await req.json().catch(() => null)
  if (
    !body ||
    typeof body.couponId !== 'string' ||
    typeof body.orderId  !== 'string'
  ) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { couponId, orderId } = body

  // ── 3. Auth — require logged-in user ──────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) {
    return NextResponse.json({ error: 'Invalid session.' }, { status: 401 })
  }

  // ── 4. Apply coupon via lib/coupon.ts ─────────────────────────────────────
  const result = await applyCoupon(couponId, user.id, orderId)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
