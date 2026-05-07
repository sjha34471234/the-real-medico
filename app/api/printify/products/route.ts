import { NextResponse } from 'next/server'

const FALLBACK_PRODUCTS = [
  {
    id: 'fallback-1',
    title: 'Medical Heartbeat Tee',
    price: 29.99,
    image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Medical+Tee',
    images: [],
    category: 'tshirts',
    description: 'Classic medical heartbeat design for healthcare professionals.',
    variants: [
      { id: 'S', title: 'S', price: 29.99, available: true },
      { id: 'M', title: 'M', price: 29.99, available: true },
      { id: 'L', title: 'L', price: 29.99, available: true },
      { id: 'XL', title: 'XL', price: 29.99, available: true },
    ],
  },
  {
    id: 'fallback-2',
    title: 'Doctor Life Hoodie',
    price: 49.99,
    image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Doctor+Hoodie',
    images: [],
    category: 'hoodies',
    description: 'Cozy hoodie for long shifts.',
    variants: [
      { id: 'S', title: 'S', price: 49.99, available: true },
      { id: 'M', title: 'M', price: 49.99, available: true },
    ],
  },
  {
    id: 'fallback-3',
    title: 'Stethoscope Mug',
    price: 19.99,
    image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Medico+Mug',
    images: [],
    category: 'mugs',
    description: 'Start your shift right.',
    variants: [{ id: 'OS', title: 'One Size', price: 19.99, available: true }],
  },
]

export async function GET() {
  // Try Printify first
  if (process.env.PRINTIFY_API_KEY && process.env.PRINTIFY_SHOP_ID) {
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

      if (response.ok) {
        const data = await response.json()
        if (data.data && data.data.length > 0) {
          const products = data.data.map((p: any) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            price: p.variants[0]?.price / 100 || 0,
            image: p.images[0]?.src || 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Product',
            images: p.images.map((img: any) => img.src),
            category: p.tags?.[0]?.toLowerCase() || 'general',
            variants: p.variants.map((v: any) => ({
              id: v.id,
              title: v.title,
              price: v.price / 100,
              available: v.is_available,
            })),
          }))
          return NextResponse.json({ products, source: 'printify' })
        }
      }
    } catch (error) {
      console.error('Printify fetch failed, using fallback:', error)
    }
  }

  // Return fallback products if Printify fails
  return NextResponse.json({
    products: FALLBACK_PRODUCTS,
    source: 'fallback',
  })
}
