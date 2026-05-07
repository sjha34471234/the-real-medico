import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'

export async function POST(req: Request) {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    const { email, name } = await req.json()

    // Create a one-time payment of $5 (₹415) for membership
    // In production you'd use Razorpay Subscriptions API
    const order = await razorpay.orders.create({
      amount: 41500, // ₹415 = ~$5
      currency: 'INR',
      receipt: `membership_${Date.now()}`,
      notes: {
        type: 'membership',
        email,
        name,
      },
    })

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    })
  } catch (error: any) {
    console.error('Subscription error:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription order' },
      { status: 500 }
    )
  }
}
