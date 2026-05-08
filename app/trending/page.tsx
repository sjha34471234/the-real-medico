import { Suspense } from 'next'
import ProductCard from '@/components/ProductCard'
import { createClient } from '@supabase/supabase-js'

export const metadata = {
  title: 'Trending — The Real Medico',
  description: 'Most popular products loved by healthcare professionals.',
}

async function getTrendingProducts() {
  try {
    // Step 1 — fetch order counts from Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: counts } = await supabase
      .from('product_order_counts')
      .select('product_id, order_count')
      .limit(12)

    // Step 2 — fetch all products from Printify
    const response = await fetch(
      `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/products.json?limit=50`,
      {
        headers: { Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}` },
        next: { revalidate: 1800 },
      }
    )
    if (!response.ok) throw new Error('Printify failed')
    const data = await response.json()

    const allProducts = data.data.map((p: any) => ({
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

    // Step 3 — if we have order data, sort by it
    if (counts && counts.length > 0) {
      const countMap = new Map(counts.map((c: any) => [c.product_id, Number(c.order_count)]))
      const trending = allProducts
        .filter((p: any) => countMap.has(p.id))
        .sort((a: any, b: any) => (countMap.get(b.id) || 0) - (countMap.get(a.id) || 0))
      // If we have fewer than 4 trending, pad with other products
      if (trending.length < 4) {
        const trendingIds = new Set(trending.map((p: any) => p.id))
        const rest = allProducts.filter((p: any) => !trendingIds.has(p.id)).slice(0, 12 - trending.length)
        return { products: [...trending, ...rest], hasRealData: trending.length > 0 }
      }
      return { products: trending.slice(0, 12), hasRealData: true }
    }

    // Step 4 — no order data yet, show all products as "trending soon"
    return { products: allProducts.slice(0, 12), hasRealData: false }

  } catch {
    // Fallback products if everything fails
    return {
      hasRealData: false,
      products: [
        { id: 'f1', title: 'Medical Heartbeat Tee', price: 29.99, image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Medical+Tee', images: [], category: 'tshirts', description: 'Classic medical design', variants: [] },
        { id: 'f2', title: 'Doctor Life Hoodie', price: 49.99, image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Doctor+Hoodie', images: [], category: 'hoodies', description: 'Cozy hoodie', variants: [] },
        { id: 'f3', title: 'Stethoscope Mug', price: 19.99, image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Medico+Mug', images: [], category: 'mugs', description: 'Start your shift right', variants: [] },
        { id: 'f4', title: 'Nurse Pride Tee', price: 27.99, image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Nurse+Tee', images: [], category: 'tshirts', description: 'For heroes in scrubs', variants: [] },
      ]
    }
  }
}

export default async function TrendingPage() {
  const { products, hasRealData } = await getTrendingProducts()

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl">🔥</span>
          <h1 className="text-4xl font-heading font-bold text-primary">Trending Now</h1>
        </div>
        <p className="text-text-slate text-lg">
          {hasRealData
            ? 'Most loved products by healthcare professionals — ranked by orders.'
            : 'Most popular picks for healthcare professionals.'}
        </p>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-3 mb-10">
        <span className="bg-red-50 text-red-600 text-sm font-semibold px-4 py-1.5 rounded-full">🔥 Best Sellers</span>
        <span className="bg-blue-50 text-primary text-sm font-semibold px-4 py-1.5 rounded-full">👨‍⚕️ Healthcare Approved</span>
        <span className="bg-green-50 text-green-700 text-sm font-semibold px-4 py-1.5 rounded-full">✅ Quality Guaranteed</span>
        {hasRealData && (
          <span className="bg-orange-50 text-orange-600 text-sm font-semibold px-4 py-1.5 rounded-full">📊 Ranked by Orders</span>
        )}
      </div>

      {/* Product grid */}
      <Suspense fallback={
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="w-full h-56 bg-slate-200 rounded-t-2xl" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-8 bg-slate-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      }>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product: any, index: number) => (
            <div key={product.id} className="relative">
              {/* Rank badge for top 3 */}
              {hasRealData && index < 3 && (
                <div className={`absolute -top-2 -left-2 z-10 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-black shadow-lg ${
                  index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-slate-400' : 'bg-orange-400'
                }`}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                </div>
              )}
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </Suspense>

      {/* Bottom CTA */}
      <div className="mt-14 card p-8 bg-accent text-center">
        <p className="text-xl font-bold text-text-dark mb-2">Want to see everything?</p>
        <p className="text-text-slate mb-5">Browse our full collection of medical merchandise</p>
        <a href="/shop" className="btn-primary inline-block">View All Products →</a>
      </div>

    </div>
  )
}
