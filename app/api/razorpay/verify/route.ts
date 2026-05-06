import { NextResponse } from 'next/server'
import crypto from 'crypto'

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
      return NextResponse.json(
        { error: 'Missing payment fields' },
        { status: 400 }
      )
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // Payment verified — now create Printify order
    if (items && customer) {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL || 'https://the-real-medico.vercel.app'}/api/printify/orders`,
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
      } catch (printifyError) {
        console.error('Printify order failed:', printifyError)
        // Don't fail the whole request — payment was successful
      }
    }

    return NextResponse.json({
      verified: true,
      payment_id: razorpay_payment_id,
    })
  } catch (error) {
    console.error('Verify error:', error)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    )
  }
}
