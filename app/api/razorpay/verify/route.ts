import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      items,
      customer,
    } = await req.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Save order to Supabase
    if (items && customer) {
      try {
        // Get user by email
        const { data: userData } = await supabaseAdmin.auth.admin.listUsers()
        const user = userData?.users?.find(u => u.email === customer.email)

        await supabaseAdmin.from('orders').insert({
          user_id: user?.id || null,
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: customer.phone,
          shipping_address: {
            address: customer.address,
            city: customer.city,
            state: customer.state,
            zip: customer.zip,
            country: customer.country,
          },
          line_items: items,
          total_amount: items.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0),
          currency: 'USD',
          razorpay_order_id,
          razorpay_payment_id,
          status: 'confirmed',
        })

        // Trigger Printify order
        await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL}/api/printify/orders`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer,
              items,
              paymentId: razorpay_payment_id,
            }),
          }
        )
      } catch (err) {
        console.error('Post-payment error:', err)
      }
    }

    return NextResponse.json({
      verified: true,
      payment_id: razorpay_payment_id,
    })
  } catch (error) {
    console.error('Verify error:', error)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
