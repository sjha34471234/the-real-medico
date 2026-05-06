import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const response = await fetch(
      `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/products.json?limit=20`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 3600 },
      }
    )

    if (!response.ok) {
      throw new Error(`Printify API error: ${response.status}`)
    }

    const data = await response.json()

    const products = data.data.map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.variants[0]?.price / 100 || 0,
      image: p.images[0]?.src || 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Product',
      images: p.images.map((img: any) => img.src),
      category: p.tags?.[0] || 'general',
      variants: p.variants.map((v: any) => ({
        id: v.id,
        title: v.title,
        price: v.price / 100,
        available: v.is_available,
      })),
    }))

    return NextResponse.json({ products })
  } catch (error: any) {
    console.error('Printify products error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products', products: [] },
      { status: 500 }
    )
  }
}
