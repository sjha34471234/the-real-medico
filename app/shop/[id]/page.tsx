import { Suspense } from 'react'
import ProductDetailClient from '@/components/ProductDetailClient'
import { notFound } from 'next/navigation'

async function getProduct(id: string) {
  try {
    const response = await fetch(
      `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/products.json?limit=20`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}`,
        },
        next: { revalidate: 3600 },
      }
    )
    if (!response.ok) throw new Error('Failed')
    const data = await response.json()
    const p = data.data.find((p: any) => p.id === id)
    if (!p) return null
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.variants[0]?.price / 100 || 0,
      image: p.images[0]?.src || '',
      images: p.images.map((img: any) => img.src),
      category: p.tags?.[0]?.toLowerCase() || 'general',
      variants: p.variants.map((v: any) => ({
        id: String(v.id),
        title: v.title,
        price: v.price / 100,
        available: v.is_available,
      })),
    }
  } catch {
    return null
  }
}
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const product = await getProduct(params.id)
  if (!product) return { title: 'Product Not Found' }
  return {
    title: `${product.title} — The Real Medico`,
    description: product.description?.replace(/<[^>]*>/g, '').slice(0, 160),
    openGraph: {
      title: product.title,
      images: [product.image],
    },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await getProduct(id)

  if (!product) notFound()
  return (
    <Suspense fallback={
      <div className="max-w-6xl mx-auto px-4 py-12 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="w-full h-96 bg-slate-200 rounded-2xl" />
          <div className="space-y-4">
            <div className="h-8 bg-slate-200 rounded w-3/4" />
            <div className="h-6 bg-slate-200 rounded w-1/4" />
            <div className="h-24 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    }>
      <ProductDetailClient product={product} />
    </Suspense>
  )
}
