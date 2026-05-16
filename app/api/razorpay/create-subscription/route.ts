// ============================================================
// FILE: app/api/razorpay/create-subscription/route.ts
// PURPOSE: Creates a Razorpay Subscription for Real Medico+ (₹415/month recurring)
// LAST CHANGED: May 15, 2026
// WHY IT EXISTS: Replaces the old one-time order approach for membership.
//   Uses Razorpay Subscriptions API for true recurring billing.
//   Falls back to one-time order if subscriptions are not enabled on account.
// DEPENDENCIES: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET env vars
// ⚠️ DO NOT CHANGE: The fallback to one-time order — this lets the site work
//   even before Razorpay subscriptions are approved on your account.
// ⚠️ DO NOT CHANGE: Amount is always INR ₹415 (41500 paise) — membership price
//   is fixed in INR regardless of user's display currency.
// ============================================================

// --- CHANGE LOG ---
// [May 15, 2026] CREATED: New subscription route replacing old one-time order
// REASON: Old route created a one-time ₹415 order with a TODO comment.
//   This route uses the real Razorpay Subscriptions API so billing auto-renews
//   monthly. Falls back gracefully if subscriptions aren't enabled yet.
// --- END CHANGE LOG ---

import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'

const MEMBERSHIP_AMOUNT_PAISE = 41500 // ₹415 in paise
const MEMBERSHIP_CURRENCY = 'INR'

export async function POST(req: Request) {
  try {
    const { email, name, userId } = await req.json()

    if (!email || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    // May 15, 2026 REASON: Try Razorpay Subscriptions API first (true recurring).
    // If the account doesn't have subscriptions enabled, Razorpay throws an error
    // and we fall back to a one-time order (existing behavior).
    try {
      // Step 1: Ensure a plan exists (or create one)
      // In production, create the plan ONCE in Razorpay dashboard and hardcode the plan_id.
      // We attempt to create it here as a convenience — Razorpay ignores duplicates if
      // you use the same interval/amount, but ideally set RAZORPAY_MEMBERSHIP_PLAN_ID in env.
      let planId = process.env.RAZORPAY_MEMBERSHIP_PLAN_ID

      if (!planId) {
        // May 15, 2026 REASON: No plan ID in env — create one dynamically.
        // This only runs once in practice; after creation, save the plan_id to env.
        const plan = await (razorpay as any).plans.create({
          period: 'monthly',
          interval: 1,
          item: {
            name: 'Real Medico+ Monthly Membership',
            amount: MEMBERSHIP_AMOUNT_PAISE,
            currency: MEMBERSHIP_CURRENCY,
            description: 'Exclusive membership for healthcare professionals',
          },
          notes: {
            type: 'membership',
          },
        })
        planId = plan.id
      }

      // Step 2: Create subscription
      const subscription = await (razorpay as any).subscriptions.create({
        plan_id: planId,
        total_count: 120, // Max 120 months (10 years) — effectively indefinite
        quantity: 1,
        customer_notify: 1, // Razorpay sends payment reminders
        notes: {
          type: 'membership',
          user_id: userId,
          email,
          name: name || '',
        },
      })

      return NextResponse.json({
        mode: 'subscription',
        subscription_id: subscription.id,
        amount: MEMBERSHIP_AMOUNT_PAISE,
        currency: MEMBERSHIP_CURRENCY,
      })

    } catch (subscriptionError: any) {
      // May 15, 2026 REASON: Subscriptions not enabled on this Razorpay account yet.
      // Fall back to one-time order so the site keeps working.
      console.warn('[create-subscription] Subscriptions API not available, falling back to one-time order:', subscriptionError?.error?.description || subscriptionError?.message)

      const order = await razorpay.orders.create({
        amount: MEMBERSHIP_AMOUNT_PAISE,
        currency: MEMBERSHIP_CURRENCY,
        receipt: `membership_${Date.now()}`,
        notes: {
          type: 'membership',
          mode: 'one_time_fallback',
          user_id: userId,
          email,
          name: name || '',
        },
      })

      return NextResponse.json({
        mode: 'order',
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
      })
    }

  } catch (error: any) {
    console.error('[create-subscription] Fatal error:', error)
    return NextResponse.json(
      { error: 'Failed to create membership payment' },
      { status: 500 }
    )
  }
}
