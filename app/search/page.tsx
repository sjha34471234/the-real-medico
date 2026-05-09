import { Suspense } from 'react'
import SearchClient from '@/components/SearchClient'

async function getAllProducts() {
  try {
    const response = await fetch(
      `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/products.json?limit=50`,
      {
        headers: { Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}` },
        next: { revalidate: 3600 },
      }
    )
    if (!response.ok) throw new Error('Failed')
    const data = await response.json()
    return data.data.map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description?.replace(/<[^>]*>/g, '').slice(0, 120) || '',
      price: p.variants[0]?.price / 100 || 0,
      image: p.images[0]?.src || 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Product',
      category: p.tags?.[0]?.toLowerCase() || 'general',
      rating: 0,
      reviewCount: 0,
      createdAt: p.created_at || new Date().toISOString(),
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
  title: 'Search — The Real Medico',
  description: 'Search medical merchandise for healthcare professionals.',
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; category?: string }>
}) {
  const params = await searchParams
  const products = await getAllProducts()
  return (
    <Suspense fallback={
      <div className="max-w-6xl mx-auto px-4 py-12 animate-pulse">
        <div className="h-12 bg-slate-200 rounded-xl mb-8" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card">
              <div className="w-full h-56 bg-slate-200 rounded-t-2xl" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-8 bg-slate-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    }>
      <SearchClient
        products={products}
        initialQuery={params.q || ''}
        initialSort={params.sort || 'relevance'}
        initialCategory={params.category || 'all'}
      />
    </Suspense>
  )
}
