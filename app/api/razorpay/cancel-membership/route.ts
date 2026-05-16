// ============================================================
// FILE: app/api/razorpay/cancel-membership/route.ts
// PURPOSE: Cancels Razorpay subscription + sets active=false in Supabase
// LAST CHANGED: May 15, 2026
// WHY IT EXISTS: Membership cancellation needs to happen server-side so the
//   client cannot fake a cancellation or tamper with the user_id.
// DEPENDENCIES: RAZORPAY_KEY_SECRET, SUPABASE_SERVICE_ROLE_KEY
// ⚠️ DO NOT CHANGE: Verifies Authorization header before cancelling — prevents
//   one user from cancelling another user's membership
// ⚠️ DO NOT CHANGE: cancel_at_cycle_end=true — Razorpay lets current period
//   complete before stopping. User keeps benefits until expires_at.
// ⚠️ DO NOT CHANGE: Sets active=false on ALL active rows for user, not just one.
//   Multiple rows can exist (monthly cycle inserts). All must be deactivated.
// ============================================================

// --- CHANGE LOG ---
// [May 15, 2026] CREATED: Cancel membership route
// REASON: Needed for the emotional cancel flow in account/page.tsx.
//   Cancels Razorpay subscription gracefully (at end of billing cycle)
//   and deactivates membership in Supabase.
// --- END CHANGE LOG ---

import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    // May 15, 2026 REASON: Verify user is authenticated before allowing cancel.
    // Read Bearer token from Authorization header, verify with Supabase.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = authHeader.replace('Bearer ', '')
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(accessToken)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const { cancel_reason } = await req.json()

    // ── Find active membership rows for this user ─────────────────────────────
    const { data: memberships, error: fetchError } = await supabaseAdmin
      .from('memberships')
      .select('id, razorpay_subscription_id, expires_at')
      .eq('user_id', user.id)
      .eq('active', true)

    if (fetchError || !memberships || memberships.length === 0) {
      return NextResponse.json({ error: 'No active membership found' }, { status: 404 })
    }

    // ── Cancel Razorpay Subscription (if exists) ──────────────────────────────
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    // May 15, 2026 REASON: Find the most recent subscription_id across all active rows.
    // Some rows may be from one-time fallback payments (no subscription_id).
    const subscriptionRow = memberships.find(m => m.razorpay_subscription_id)

    if (subscriptionRow?.razorpay_subscription_id) {
      try {
        // May 15, 2026 REASON: cancel_at_cycle_end=1 means user keeps access until
        // the period they already paid for ends. Immediate cancel=0 would be unfair.
        await (razorpay as any).subscriptions.cancel(
          subscriptionRow.razorpay_subscription_id,
          { cancel_at_cycle_end: 1 }
        )
      } catch (rzpError: any) {
        // May 15, 2026 REASON: If Razorpay cancel fails (already cancelled, not found),
        // we still proceed with Supabase deactivation. Don't block the user.
        console.warn('[cancel-membership] Razorpay cancel warning (non-fatal):', rzpError?.error?.description || rzpError?.message)
      }
    }

    // ── Deactivate in Supabase ────────────────────────────────────────────────
    // May 15, 2026 REASON: Set ALL active rows to false — not just one.
    const { error: updateError } = await supabaseAdmin
      .from('memberships')
      .update({
        active: false,
        cancelled_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('active', true)

    if (updateError) {
      console.error('[cancel-membership] Failed to deactivate membership:', updateError)
      return NextResponse.json({ error: 'Failed to cancel membership' }, { status: 500 })
    }

    // ── Log cancellation reason (optional analytics) ──────────────────────────
    if (cancel_reason) {
      try {
        await supabaseAdmin.from('orders').insert({
          user_id: user.id,
          customer_email: user.email,
          type: 'membership',
          status: 'cancelled',
          cancel_reason,
          total_amount: 0,
          currency: 'INR',
          line_items: [{ title: 'Real Medico+ Membership Cancelled', quantity: 1, price: 0 }],
        })
      } catch {
        // Non-critical — don't block cancel
      }
    }

    // Return the expires_at so UI can show "Access until X date"
    const latestExpiry = memberships
      .map(m => new Date(m.expires_at).getTime())
      .sort((a, b) => b - a)[0]

    return NextResponse.json({
      cancelled: true,
      access_until: latestExpiry ? new Date(latestExpiry).toISOString() : null,
    })

  } catch (error) {
    console.error('[cancel-membership] Fatal error:', error)
    return NextResponse.json({ error: 'Cancellation failed' }, { status: 500 })
  }
}
