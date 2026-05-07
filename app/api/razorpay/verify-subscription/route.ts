import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      user_email,
    } = await req.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // TODO: Save membership to Supabase
    // await supabaseAdmin.from('memberships').upsert({
    //   email: user_email,
    //   payment_id: razorpay_payment_id,
    //   active: true,
    //   started_at: new Date().toISOString()
    // })

    return NextResponse.json({
      verified: true,
      payment_id: razorpay_payment_id,
    })
  } catch (error) {
    console.error('Verify subscription error:', error)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    )
  }
}
