// ============================================================
// FILE: app/api/orders/track/route.ts
// PURPOSE: Fetches order tracking status from Printify for a given order
// LAST CHANGED: May 17, 2026
// WHY IT EXISTS: Allows users to see fulfillment status + shipping tracking
//   directly in their account Orders tab without leaving the site.
// DEPENDENCIES: Supabase (service role — verifies order belongs to user),
//   Printify API, PRINTIFY_API_KEY, PRINTIFY_SHOP_ID
// ⚠️ DO NOT CHANGE: Always verify the order belongs to the requesting user before
//   returning tracking data. Never look up by printify_order_id alone —
//   that would let any logged-in user track any order.
// ⚠️ DO NOT CHANGE: Authorization: Bearer header required — same pattern as cancel-membership.
//   No token = no tracking data returned.
// ============================================================

// --- CHANGE LOG ---
// [May 17, 2026] CREATED: Order tracking via Printify API
// REASON: Users had no way to check fulfillment status after placing an order.
// --- END CHANGE LOG ---

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Printify order status → human-readable label + colour class
const STATUS_MAP: Record<string, { label: string; colour: string; emoji: string }> = {
  pending:            { label: 'Order Received',      colour: 'text-slate-600',  emoji: '📋' },
  on_hold:            { label: 'On Hold',              colour: 'text-orange-600', emoji: '⏸️' },
  payment_not_received: { label: 'Awaiting Payment',  colour: 'text-red-600',    emoji: '💳' },
  fulfilled:          { label: 'Fulfilled',            colour: 'text-green-600',  emoji: '✅' },
  partially_fulfilled:{ label: 'Partially Fulfilled',  colour: 'text-blue-600',   emoji: '📦' },
  cancelled:          { label: 'Cancelled',            colour: 'text-red-600',    emoji: '❌' },
  in_production:      { label: 'In Production',        colour: 'text-blue-600',   emoji: '🏭' },
  ready_for_print:    { label: 'Ready for Print',      colour: 'text-blue-500',   emoji: '🖨️' },
  sent_to_production: { label: 'Sent to Production',   colour: 'text-blue-600',   emoji: '🏭' },
  shipping:           { label: 'Shipped',              colour: 'text-green-600',  emoji: '🚚' },
}

export async function GET(req: Request) {
  try {
    // ── 1. Verify user session ────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    // ── 2. Get orderId from query param ───────────────────────────────────────
    const { searchParams } = new URL(req.url)
    const supabaseOrderId = searchParams.get('orderId')

    if (!supabaseOrderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
    }

    // ── 3. Verify order belongs to this user + get printify_order_id ──────────
    // May 17, 2026 REASON: Security check — user can only track their own orders.
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, printify_order_id, status, created_at, line_items')
      .eq('id', supabaseOrderId)
      .eq('user_id', user.id)         // ← ownership check
      .eq('type', 'product')
      .maybeSingle()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!order.printify_order_id) {
      // Order exists but Printify ID not yet saved (race condition on new orders)
      return NextResponse.json({
        status: 'pending',
        label: 'Order Received',
        emoji: '📋',
        colour: 'text-slate-600',
        shipments: [],
        message: 'Your order has been received and is being prepared for production.',
      })
    }

    // ── 4. Fetch order status from Printify ───────────────────────────────────
    const printifyRes = await fetch(
      `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/orders/${order.printify_order_id}.json`,
      {
        headers: { Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}` },
        next: { revalidate: 300 }, // May 17, 2026 REASON: Cache 5 min — status doesn't change by the second
      }
    )

    if (!printifyRes.ok) {
      console.error('[orders/track] Printify fetch failed:', printifyRes.status)
      return NextResponse.json({ error: 'Could not fetch tracking info' }, { status: 502 })
    }

    const printifyOrder = await printifyRes.json()
    const rawStatus: string = printifyOrder.status ?? 'pending'
    const statusInfo = STATUS_MAP[rawStatus] ?? { label: rawStatus, colour: 'text-slate-600', emoji: '📦' }

    // ── 5. Extract shipment / tracking info ───────────────────────────────────
    // May 17, 2026 REASON: Printify returns shipments array — each shipment has a
    //   carrier, tracking number, and tracking URL. Multiple shipments possible
    //   for partial fulfilment.
    const shipments = (printifyOrder.shipments ?? []).map((s: any) => ({
      carrier:      s.carrier ?? '',
      number:       s.number ?? '',
      url:          s.url ?? null,
      delivered_at: s.delivered_at ?? null,
      shipped_at:   s.shipped_at ?? null,
    }))

    return NextResponse.json({
      status:    rawStatus,
      label:     statusInfo.label,
      emoji:     statusInfo.emoji,
      colour:    statusInfo.colour,
      shipments,
      printify_order_id: order.printify_order_id,
      created_at: order.created_at,
    })

  } catch (err: any) {
    console.error('[orders/track] error:', err?.message ?? err)
    return NextResponse.json({ error: 'Tracking lookup failed' }, { status: 500 })
  }
}
