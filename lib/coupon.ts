// ============================================================
// FILE: lib/coupon.ts
// PURPOSE: Pure coupon logic — validateCoupon() and applyCoupon().
//   No UI. No React. No Next.js. Importable by any route.
// LAST CHANGED: May 19, 2026
// WHY IT EXISTS: Coupon system — extracted per modular architecture mandate.
//   All coupon business logic lives here. Routes are orchestrators only.
// USED BY:
//   app/api/coupon/validate/route.ts
//   app/api/coupon/apply/route.ts
// ⚠️ DO NOT CHANGE: Coupon discount DISABLES sale+member discounts entirely.
//   When a coupon is applied it is the ONLY discount. See handlePayment in CheckoutForm.
// ⚠️ DO NOT CHANGE: validateCoupon uses anon Supabase client — read-only, no auth.
//   applyCoupon uses service role client — writes coupon_uses row.
// ⚠️ DO NOT CHANGE: 'shipping' type coupons always have value=0.
//   The type itself means free shipping — value is irrelevant.
// ============================================================

// --- CHANGE LOG ---
// [May 19, 2026] CREATED: New file for coupon system
// REASON: Coupon system Tier 3 feature — lib/ file per architecture mandate.
// --- END CHANGE LOG ---

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CouponType = 'percent' | 'fixed' | 'shipping'

export interface Coupon {
  id: string
  code: string
  type: CouponType
  value: number           // percent (0-100) | fixed USD amount | 0 for shipping
  min_order_usd: number
  max_uses: number | null
  uses: number
  one_per_user: boolean
  members_only: boolean
  non_members_only: boolean
  expires_at: string | null
  active: boolean
}

export interface ValidateCouponResult {
  valid: boolean
  coupon: Coupon | null
  // What the coupon actually gives — computed once here, used by UI + validate-discount
  discountPercent: number     // 0 if type is 'fixed' or 'shipping'
  discountUSD: number         // 0 if type is 'percent' or 'shipping'
  freeShipping: boolean
  reason: string | null       // human-readable error if valid=false
}

export interface ApplyCouponResult {
  success: boolean
  error: string | null
}

// ── Clients ───────────────────────────────────────────────────────────────────

// May 19, 2026 REASON: Anon client for validate — public read only (active coupons policy).
function anonClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// May 19, 2026 REASON: Service role for apply — writes to coupon_uses, bypasses RLS.
function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── validateCoupon ────────────────────────────────────────────────────────────

/**
 * Validates a coupon code for a given user + cart total.
 * Uses anon Supabase client — no auth needed.
 *
 * @param code         - Raw coupon code from user input (uppercased internally)
 * @param userId       - Supabase user ID (null if not logged in)
 * @param isMember     - Whether the user has an active Real Medico+ membership
 * @param subtotalUSD  - Cart subtotal in USD BEFORE any discount
 */
export async function validateCoupon(
  code: string,
  userId: string | null,
  isMember: boolean,
  subtotalUSD: number
): Promise<ValidateCouponResult> {
  const INVALID = (reason: string): ValidateCouponResult => ({
    valid: false,
    coupon: null,
    discountPercent: 0,
    discountUSD: 0,
    freeShipping: false,
    reason,
  })

  if (!code || !code.trim()) return INVALID('Please enter a coupon code.')

  const supabase = anonClient()

  // May 19, 2026 REASON: Codes stored and compared uppercase — normalise on input.
  const normalised = code.trim().toUpperCase()

  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', normalised)
    .eq('active', true)
    .maybeSingle()

  if (error || !coupon) return INVALID('Invalid coupon code.')

  // ── Expiry ────────────────────────────────────────────────────────────────
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return INVALID('This coupon has expired.')
  }

  // ── Global use limit ──────────────────────────────────────────────────────
  if (coupon.max_uses !== null && coupon.uses >= coupon.max_uses) {
    return INVALID('This coupon has reached its usage limit.')
  }

  // ── Minimum order ─────────────────────────────────────────────────────────
  if (subtotalUSD < coupon.min_order_usd) {
    return INVALID(
      `This coupon requires a minimum order of $${coupon.min_order_usd.toFixed(2)}.`
    )
  }

  // ── Member/non-member restriction ─────────────────────────────────────────
  if (coupon.members_only && !isMember) {
    return INVALID('This coupon is for Real Medico+ members only.')
  }
  if (coupon.non_members_only && isMember) {
    return INVALID('This coupon is for non-members only.')
  }

  // ── One per user ──────────────────────────────────────────────────────────
  if (coupon.one_per_user) {
    if (!userId) {
      // May 19, 2026 REASON: Can't check usage without a user ID — require login.
      return INVALID('Please log in to use this coupon.')
    }
    const { data: existing } = await supabase
      .from('coupon_uses')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) return INVALID('You have already used this coupon.')
  }

  // ── Compute what the coupon gives ─────────────────────────────────────────
  let discountPercent = 0
  let discountUSD     = 0
  const freeShipping  = coupon.type === 'shipping'

  if (coupon.type === 'percent') {
    discountPercent = coupon.value
    discountUSD     = parseFloat(((subtotalUSD * coupon.value) / 100).toFixed(2))
  } else if (coupon.type === 'fixed') {
    // May 19, 2026 REASON: Cap fixed discount at subtotal — never go negative.
    discountUSD     = Math.min(coupon.value, subtotalUSD)
    discountPercent = 0
  }
  // 'shipping' type: both stay 0, freeShipping=true is the benefit

  return {
    valid: true,
    coupon,
    discountPercent,
    discountUSD,
    freeShipping,
    reason: null,
  }
}

// ── applyCoupon ───────────────────────────────────────────────────────────────

/**
 * Records a coupon use after payment is confirmed.
 * Uses service role client — writes to coupon_uses and increments uses counter.
 * Called by app/api/coupon/apply/route.ts AFTER order is verified.
 *
 * @param couponId  - UUID of the coupon (from validateCoupon result)
 * @param userId    - Supabase user ID
 * @param orderId   - Razorpay order ID for audit trail
 */
export async function applyCoupon(
  couponId: string,
  userId: string,
  orderId: string
): Promise<ApplyCouponResult> {
  const supabase = serviceClient()

  // May 19, 2026 REASON: Insert use record — UNIQUE(coupon_id, user_id) prevents duplicates
  //   at DB level even if apply is called twice (race condition / double-submit).
  const { error: insertError } = await supabase
    .from('coupon_uses')
    .insert({ coupon_id: couponId, user_id: userId, order_id: orderId })

  if (insertError) {
    // May 19, 2026 REASON: Unique constraint violation = already applied. Not an error for UX.
    if (insertError.code === '23505') {
      return { success: true, error: null }
    }
    return { success: false, error: 'Failed to record coupon use.' }
  }

  // May 19, 2026 REASON: Increment global uses counter for max_uses enforcement.
  //   Using rpc increment avoids race condition vs read-then-write.
  await supabase.rpc('increment_coupon_uses', { coupon_id_input: couponId })

  return { success: true, error: null }
}
