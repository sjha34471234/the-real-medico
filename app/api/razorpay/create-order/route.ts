import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'

export async function POST(req: Request) {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    const { amount } = await req.json()

    // Convert USD to INR (approximate) then to paise
    const amountInPaise = Math.round(Number(amount) * 100)

    if (amountInPaise < 100) {
      return NextResponse.json(
        { error: 'Minimum amount is $1' },
        { status: 400 }
      )
    }

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `trm_${Date.now()}`,
    })

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    })
  } catch (error: any) {
    console.error('Razorpay error:', error?.error || error)
    return NextResponse.json(
      { error: error?.error?.description || 'Failed to create order' },
      { status: 500 }
    )
  }
}
