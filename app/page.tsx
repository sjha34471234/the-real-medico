import { Suspense } from 'react'
import HomeClient from '@/components/HomeClient'

async function getFeaturedProducts() {
  try {
    const response = await fetch(
      `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/products.json?limit=4`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}`,
        },
        next: { revalidate: 3600 },
      }
    )
    if (!response.ok) throw new Error('Printify failed')
    const data = await response.json()
    return data.data.slice(0, 4).map((p: any) => ({
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
  } catch {
    return []
  }
}

export const metadata = {
  title: 'The Real Medico — Premium Medical Merchandise',
  description: 'Premium merchandise for healthcare heroes. T-shirts, hoodies, mugs and more designed for medical professionals.',
  openGraph: {
    title: 'The Real Medico',
    description: 'Premium merchandise for healthcare heroes.',
    type: 'website',
    url: 'https://therealmedico.store',
  },
}

export default async function HomePage() {
  const featuredProducts = await getFeaturedProducts()
  return <HomeClient featuredProducts={featuredProducts} />
}
