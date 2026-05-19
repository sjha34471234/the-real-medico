// ============================================================
// FILE: app/api/coupon/validate/route.ts
// PURPOSE: Validates a coupon code — rate limit → parse → validateCoupon() → return.
//   Orchestration only. All logic in lib/coupon.ts.
// LAST CHANGED: May 19, 2026
// WHY IT EXISTS: Public endpoint called by CouponInput component on Apply click.
// DEPENDENCIES: lib/coupon.ts, lib/rateLimit.ts
// ⚠️ DO NOT CHANGE: Uses SERVICE ROLE client for auth.getUser() + membership check.
//   Anon client memberships query hits RLS → returns empty even for valid members.
//   Service role bypasses RLS correctly. Same pattern as validate-discount/route.ts.
// ⚠️ DO NOT CHANGE: isMember verified server-side from Authorization header only.
//   Never trust isMember from request body.
// ============================================================

// --- CHANGE LOG ---
// [May 19, 2026] CREATED: New route for coupon validation
// REASON: Coupon system Tier 3 feature.
// [May 19, 2026] FIXED: Switched anon client → service role client for
//   auth.getUser() + memberships query.
// REASON: Anon client memberships query blocked by RLS — members incorrectly
//   identified as non-members, causing members_only coupons to reject valid members.
// --- END CHANGE LOG ---

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit'
import { validateCoupon } from '@/lib/coupon'

// May 19, 2026 FIX: Service role — bypasses RLS on memberships table.
//   Module-level so it is not recreated on every request.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // ── 1. Rate limit ─────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  if (!checkRateLimit(ip, 'couponValidate')) {
    return rateLimitResponse(RATE_LIMITS.couponValidate.windowMs)
  }

  // ── 2. Parse + validate body ──────────────────────────────────────────────
  const body = await req.json().catch(() => null)
  if (!body || typeof body.code !== 'string') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { code, subtotalUSD } = body

  if (typeof subtotalUSD !== 'number' || subtotalUSD <= 0) {
    return NextResponse.json({ error: 'Invalid cart total.' }, { status: 400 })
  }

  // ── 3. Resolve user + membership from Authorization header ────────────────
  // May 19, 2026 FIX: Service role client for both getUser() and memberships query.
  //   Old code used anon client — memberships query was blocked by RLS → isMember
  //   always false → members_only coupons rejected valid members.
  let userId: string | null = null
  let isMember              = false

  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)

    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (user) {
      userId = user.id
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('id')
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle()
      isMember = !!membership
    }
  }

  // ── 4. Validate coupon via lib/coupon.ts ──────────────────────────────────
  const result = await validateCoupon(code, userId, isMember, subtotalUSD)

  if (!result.valid) {
    return NextResponse.json({ valid: false, reason: result.reason }, { status: 200 })
  }

  // ── 5. Return validated coupon details ────────────────────────────────────
  return NextResponse.json({
    valid:           true,
    couponId:        result.coupon!.id,
    code:            result.coupon!.code,
    type:            result.coupon!.type,
    discountPercent: result.discountPercent,
    discountUSD:     result.discountUSD,
    freeShipping:    result.freeShipping,
  })
}
