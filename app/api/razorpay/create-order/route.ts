import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'

// Shipping charges in INR based on country
function getShippingCharge(country: string): number {
  const c = country?.toLowerCase().trim()

  // Free shipping for these
  if (!c || c === 'india') return 0

  // Neighboring / affordable regions
  const zone1 = ['nepal', 'bangladesh', 'sri lanka', 'bhutan', 'myanmar']
  if (zone1.includes(c)) return 299

  // Southeast Asia & Middle East
  const zone2 = ['uae', 'singapore', 'malaysia', 'thailand', 'indonesia', 'philippines', 'vietnam', 'qatar', 'kuwait', 'bahrain', 'oman', 'saudi arabia']
  if (zone2.includes(c)) return 599

  // USA, UK, Europe, Australia, Canada, NZ
  const zone3 = ['united states', 'usa', 'us', 'united kingdom', 'uk', 'canada', 'australia', 'germany', 'france', 'netherlands', 'italy', 'spain', 'sweden', 'norway', 'denmark', 'finland', 'switzerland', 'austria', 'belgium', 'new zealand', 'ireland', 'portugal']
  if (zone3.includes(c)) return 899

  // Africa & South America
  const zone4 = ['south africa', 'nigeria', 'kenya', 'ghana', 'brazil', 'argentina', 'mexico', 'colombia']
  if (zone4.includes(c)) return 1099

  // Everything else
  return 999
}

export async function POST(req: Request) {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    const { amount, country } = await req.json()

    const productAmountInPaise = Math.round(Number(amount) * 100)
    const shippingInPaise = getShippingCharge(country || 'india') * 100
    const totalInPaise = productAmountInPaise + shippingInPaise

    if (totalInPaise < 100) {
      return NextResponse.json(
        { error: 'Minimum order amount is ₹1' },
        { status: 400 }
      )
    }

    const order = await razorpay.orders.create({
      amount: totalInPaise,
      currency: 'INR',
      receipt: `trm_${Date.now()}`,
    })

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      shipping: shippingInPaise / 100,      // in INR for display
      product_amount: productAmountInPaise / 100,
    })
  } catch (error: any) {
    console.error('Razorpay error:', error?.error || error)
    return NextResponse.json(
      { error: error?.error?.description || 'Failed to create order' },
      { status: 500 }
    )
  }
}
