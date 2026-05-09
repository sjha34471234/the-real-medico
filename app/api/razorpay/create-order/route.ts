import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'

type CurrencyCode = 'INR' | 'USD' | 'GBP' | 'AED' | 'SGD' | 'MYR' | 'AUD' | 'CAD'

// Fallback rates vs USD (used only if frontend somehow doesn't send converted amount)
const USD_RATES: Record<CurrencyCode, number> = {
  INR: 83, USD: 1, GBP: 0.79, AED: 3.67,
  SGD: 1.34, MYR: 4.7, AUD: 1.53, CAD: 1.36,
}

// Shipping charges in INR — we convert to target currency
function getShippingChargeINR(country: string): number {
  const c = country?.toLowerCase().trim()
  if (!c || c === 'india') return 0
  const zone1 = ['nepal', 'bangladesh', 'sri lanka', 'bhutan', 'myanmar']
  if (zone1.includes(c)) return 299
  const zone2 = ['uae', 'singapore', 'malaysia', 'thailand', 'indonesia', 'philippines', 'vietnam', 'qatar', 'kuwait', 'bahrain', 'oman', 'saudi arabia']
  if (zone2.includes(c)) return 599
  const zone3 = ['united states', 'usa', 'us', 'united kingdom', 'uk', 'canada', 'australia', 'germany', 'france', 'netherlands', 'italy', 'spain', 'sweden', 'norway', 'denmark', 'finland', 'switzerland', 'austria', 'belgium', 'new zealand', 'ireland', 'portugal']
  if (zone3.includes(c)) return 899
  const zone4 = ['south africa', 'nigeria', 'kenya', 'ghana', 'brazil', 'argentina', 'mexico', 'colombia']
  if (zone4.includes(c)) return 1099
  return 999
}

export async function POST(req: Request) {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    const { amount, currency = 'INR', country = 'india' } = await req.json()

    const currencyCode = (currency as CurrencyCode) in USD_RATES
      ? (currency as CurrencyCode)
      : 'INR'

    // amount already comes from frontend as smallest unit (paise, cents, fils, etc.)
    // so we just use it directly — no further multiplication needed
    const productAmountSmallest = Math.round(Number(amount))

    // Convert shipping from INR to target currency
    const shippingINR = getShippingChargeINR(country)
    const shippingConverted = currencyCode === 'INR'
      ? shippingINR
      : (shippingINR / USD_RATES['INR']) * USD_RATES[currencyCode]
    const shippingSmallest = Math.round(shippingConverted * 100)

    const totalSmallest = productAmountSmallest + shippingSmallest

    if (totalSmallest < 100) {
      return NextResponse.json(
        { error: `Minimum order amount is 1 ${currencyCode}` },
        { status: 400 }
      )
    }

    const order = await razorpay.orders.create({
      amount: totalSmallest,
      currency: currencyCode,
      receipt: `trm_${Date.now()}`,
    })

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      // Return shipping in major units for display
      shipping: shippingSmallest / 100,
      product_amount: productAmountSmallest / 100,
    })

  } catch (error: any) {
    console.error('Razorpay error:', error?.error || error)
    return NextResponse.json(
      { error: error?.error?.description || 'Failed to create order' },
      { status: 500 }
    )
  }
}
