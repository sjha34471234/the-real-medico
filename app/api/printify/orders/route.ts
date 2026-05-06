import { NextResponse } from 'next/server'

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
        country: customer.country === 'India' ? 'IN' : 'US',
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
    return NextResponse.json({ success: true, orderId: data.id })
  } catch (error: any) {
    console.error('Printify order error:', error)
    return NextResponse.json(
      { error: 'Failed to create Printify order' },
      { status: 500 }
    )
  }
}
