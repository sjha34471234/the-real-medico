// ============================================================
// FILE: app/api/razorpay/verify-subscription/route.ts
// PURPOSE: Verifies Razorpay membership payment, inserts memberships row,
//          logs payment in orders table as type='membership'
// LAST CHANGED: May 15, 2026
// WHY IT EXISTS: Old route verified signature but had TODO — Supabase insert
//   was commented out. This replaces it with the full implementation.
// DEPENDENCIES: RAZORPAY_KEY_SECRET, SUPABASE_SERVICE_ROLE_KEY
// ⚠️ DO NOT CHANGE: Uses service role key — bypasses RLS to insert membership
// ⚠️ DO NOT CHANGE: Handles both subscription mode and one-time order fallback
//   signature formats — they differ (subscription uses subscription_id, not order_id)
// ⚠️ DO NOT CHANGE: memberships uses boolean `active` column — NOT status text
// ⚠️ DO NOT CHANGE: Always inserts a NEW memberships row per payment cycle —
//   do NOT upsert/update. Each month = new row for audit trail.
// ============================================================

// --- CHANGE LOG ---
// [May 15, 2026] CREATED: Full replacement of stub verify-subscription route
// REASON: Old route had Supabase insert commented out (TODO). This version:
//   1. Verifies HMAC signature (handles both subscription + order modes)
//   2. Inserts new memberships row with 30-day expiry
//   3. Logs payment in orders table as type='membership'
//   4. Returns membership expiry date to client for display
// --- END CHANGE LOG ---

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// May 15, 2026 REASON: Service role key — RLS would block anon inserts to memberships
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      razorpay_payment_id,
      razorpay_signature,
      // Subscription mode fields
      razorpay_subscription_id,
      // Order fallback mode fields
      razorpay_order_id,
      // Common
      user_id,
      user_email,
      mode, // 'subscription' | 'order'
    } = body

    if (!razorpay_payment_id || !razorpay_signature || !user_id || !user_email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // ── Signature Verification ────────────────────────────────────────────────
    // May 15, 2026 REASON: Subscription mode and order mode use different
    // signature formats. Must handle both because of the fallback.
    let signaturePayload: string

    if (mode === 'subscription' && razorpay_subscription_id) {
      // Subscription: payload = payment_id + '|' + subscription_id
      signaturePayload = `${razorpay_payment_id}|${razorpay_subscription_id}`
    } else if (razorpay_order_id) {
      // One-time order fallback: payload = order_id + '|' + payment_id
      signaturePayload = `${razorpay_order_id}|${razorpay_payment_id}`
    } else {
      return NextResponse.json({ error: 'Missing order or subscription ID' }, { status: 400 })
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(signaturePayload)
      .digest('hex')

    // May 15, 2026 REASON: Timing-safe comparison prevents timing attacks
    const signaturesMatch = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(razorpay_signature, 'hex')
    )

    if (!signaturesMatch) {
      console.error('[verify-subscription] Invalid signature for payment:', razorpay_payment_id)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // ── Duplicate Payment Guard ───────────────────────────────────────────────
    // May 15, 2026 REASON: Prevent double-insert if webhook fires twice
    const { data: existingMembership } = await supabaseAdmin
      .from('memberships')
      .select('id')
      .eq('razorpay_payment_id', razorpay_payment_id)
      .maybeSingle()

    if (existingMembership) {
      // Already processed — return success without inserting again
      return NextResponse.json({ verified: true, payment_id: razorpay_payment_id, already_processed: true })
    }

    // ── Insert New Membership Row ─────────────────────────────────────────────
    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setMonth(expiresAt.getMonth() + 1)

    // May 15, 2026 REASON: Always INSERT new row per payment — never upsert.
    // Each billing cycle = separate row for full audit trail.
    // Multiple active rows for same user is intentional (overlapping periods are fine).
    const { error: membershipError } = await supabaseAdmin
      .from('memberships')
      .insert({
        user_id,
        email: user_email,
        razorpay_payment_id,
        razorpay_subscription_id: razorpay_subscription_id || null,
        active: true,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })

    if (membershipError) {
      console.error('[verify-subscription] Failed to insert membership:', membershipError)
      return NextResponse.json({ error: 'Failed to activate membership' }, { status: 500 })
    }

    // ── Log in Orders Table ───────────────────────────────────────────────────
    // May 15, 2026 REASON: User asked membership payments to show in orders history.
    // type='membership' distinguishes from product orders.
    try {
      // Count how many membership rows this user has — determines which month this is
      const { count } = await supabaseAdmin
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user_id)

      await supabaseAdmin.from('orders').insert({
        user_id,
        customer_email: user_email,
        type: 'membership',
        membership_month: count || 1,
        razorpay_payment_id,
        razorpay_order_id: razorpay_order_id || null,
        total_amount: 5, // $5 USD equivalent — membership is always ₹415 = ~$5
        currency: 'INR',
        status: 'confirmed',
        line_items: [{
          title: 'Real Medico+ Monthly Membership',
          quantity: 1,
          price: 5,
          currency_display: '₹415',
        }],
      })
    } catch (ordersError) {
      // May 15, 2026 REASON: Orders logging is non-critical — membership is already
      // activated above. Log the error but don't fail the request.
      console.error('[verify-subscription] Failed to log in orders (non-fatal):', ordersError)
    }

    return NextResponse.json({
      verified: true,
      payment_id: razorpay_payment_id,
      expires_at: expiresAt.toISOString(),
    })

  } catch (error) {
    console.error('[verify-subscription] Fatal error:', error)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
