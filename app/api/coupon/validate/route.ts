// ============================================================
// FILE: app/api/coupon/validate/route.ts
// PURPOSE: Validates a coupon code — rate limit → parse → validateCoupon() → return.
//   Orchestration only. All logic in lib/coupon.ts.
// LAST CHANGED: May 19, 2026
// WHY IT EXISTS: Public endpoint called by CouponInput component on Apply click.
// DEPENDENCIES: lib/coupon.ts, lib/rateLimit.ts
// ⚠️ DO NOT CHANGE: Uses anon Supabase client internally (via lib/coupon.ts).
//   This route does NOT write anything — read-only validation.
// ⚠️ DO NOT CHANGE: isMember verified here from Authorization header —
//   client passes accessToken, server confirms membership from DB.
//   Do not trust isMember from request body.
// ============================================================

// --- CHANGE LOG ---
// [May 19, 2026] CREATED: New route for coupon validation
// REASON: Coupon system Tier 3 feature.
// --- END CHANGE LOG ---

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit'
import { validateCoupon } from '@/lib/coupon'

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

  const { code, subtotalUSD, currency } = body

  if (typeof subtotalUSD !== 'number' || subtotalUSD <= 0) {
    return NextResponse.json({ error: 'Invalid cart total.' }, { status: 400 })
  }

  // ── 3. Resolve user + membership from Authorization header ────────────────
  // May 19, 2026 REASON: Server confirms membership — never trust body.isMember.
  let userId: string | null   = null
  let isMember                = false

  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) {
      userId = user.id
      const { data: membership } = await supabase
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
