// ============================================================
// FILE: app/api/printify/orders/route.ts
// PURPOSE: Creates a Printify order and saves the Printify order ID back to Supabase
// LAST CHANGED: May 17, 2026
// WHY IT EXISTS: Handles print-on-demand fulfillment after Razorpay payment verified
// DEPENDENCIES: Supabase (service role), Printify API, PRINTIFY_API_KEY, PRINTIFY_SHOP_ID
// ⚠️ DO NOT CHANGE: razorpay_payment_id is used to find the correct Supabase orders row.
//   verify/route.ts inserts the order with razorpay_payment_id before calling this route.
//   The update must match on razorpay_payment_id — not razorpay_order_id.
// ⚠️ DO NOT CHANGE: country mapping — Printify requires ISO 2-letter codes.
//   Expand the map as new countries are added, never pass raw country strings.
// ============================================================

// --- CHANGE LOG ---
// [May 17, 2026] ADDED: Save printify_order_id back to Supabase orders row
// REASON: Without this, order tracking is impossible — no link between
//   Supabase order and Printify fulfillment record.
// --- END CHANGE LOG ---

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// May 17, 2026 REASON: Service role needed to update orders row
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// May 17, 2026 REASON: Printify requires ISO 3166-1 alpha-2 country codes.
// Expand this map as new shipping destinations are added to the store.
const COUNTRY_CODES: Record<string, string> = {
  'india': 'IN',
  'united states': 'US', 'usa': 'US', 'us': 'US',
  'united kingdom': 'GB', 'uk': 'GB',
  'canada': 'CA',
  'australia': 'AU',
  'germany': 'DE',
  'france': 'FR',
  'netherlands': 'NL',
  'italy': 'IT',
  'spain': 'ES',
  'sweden': 'SE',
  'norway': 'NO',
  'denmark': 'DK',
  'finland': 'FI',
  'switzerland': 'CH',
  'austria': 'AT',
  'belgium': 'BE',
  'new zealand': 'NZ',
  'ireland': 'IE',
  'portugal': 'PT',
  'uae': 'AE',
  'singapore': 'SG',
  'malaysia': 'MY',
  'thailand': 'TH',
  'indonesia': 'ID',
  'philippines': 'PH',
  'vietnam': 'VN',
  'qatar': 'QA',
  'kuwait': 'KW',
  'bahrain': 'BH',
  'oman': 'OM',
  'saudi arabia': 'SA',
  'nepal': 'NP',
  'bangladesh': 'BD',
  'sri lanka': 'LK',
  'bhutan': 'BT',
  'myanmar': 'MM',
  'south africa': 'ZA',
  'nigeria': 'NG',
  'kenya': 'KE',
  'ghana': 'GH',
  'brazil': 'BR',
  'argentina': 'AR',
  'mexico': 'MX',
  'colombia': 'CO',
}

function toCountryCode(country: string): string {
  return COUNTRY_CODES[country?.toLowerCase().trim()] ?? 'IN'
}

export async function POST(req: Request) {
  try {
    const { customer, items, paymentId } = await req.json()

    const lineItems = items.map((item: any) => ({
      product_id: item.productId,
      variant_id: parseInt(item.variantId),
      quantity: item.quantity,
    }))

    const order = {
      external_id: `order_${Date.now()}`,
      label: `The Real Medico - ${paymentId}`,
      line_items: lineItems,
      shipping_method: 1,
      send_shipping_notification: true,
      address_to: {
        first_name: customer.name.split(' ')[0],
        last_name: customer.name.split(' ').slice(1).join(' ') || 'Customer',
        email: customer.email,
        phone: customer.phone,
        // May 17, 2026 REASON: Use proper ISO codes via map — Printify rejects raw strings
        country: toCountryCode(customer.country),
        region: customer.state,
        address1: customer.address,
        city: customer.city,
        zip: customer.zip,
      },
    }

    const response = await fetch(
      `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/orders.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(order),
      }
    )

    if (!response.ok) {
      const err = await response.json()
      throw new Error(JSON.stringify(err))
    }

    const data = await response.json()
    const printifyOrderId: string = data.id

    // May 17, 2026 REASON: Save Printify order ID back to Supabase so order tracking works.
    //   Match on razorpay_payment_id — unique per transaction, set by verify/route.ts.
    if (printifyOrderId && paymentId) {
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ printify_order_id: printifyOrderId })
        .eq('razorpay_payment_id', paymentId)
        .eq('type', 'product') // May 17, 2026 REASON: Never accidentally update membership rows

      if (updateError) {
        // May 17, 2026 REASON: Log but don't fail the response — Printify order was created
        //   successfully. Missing ID is recoverable via Printify dashboard.
        console.error('[printify/orders] Failed to save printify_order_id to Supabase:', updateError)
      }
    }

    return NextResponse.json({ success: true, orderId: printifyOrderId })

  } catch (error: any) {
    console.error('Printify order error:', error)
    return NextResponse.json(
      { error: 'Failed to create Printify order' },
      { status: 500 }
    )
  }
}
