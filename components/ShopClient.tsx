// ============================================================
// FILE: components/ShopClient.tsx
// PURPOSE: Shop page client — category filter, search, and product grid
// LAST CHANGED: May 13, 2026
// WHY IT EXISTS: Client-side filtering/search for the /shop page
// DEPENDENCIES: ProductCard, lib/activeSale.ts, supabase auth
// ⚠️ DO NOT CHANGE: fetchActiveSale called ONCE here, not inside each ProductCard
// ⚠️ DO NOT CHANGE: onAuthStateChange pattern for membership check
// ============================================================

// --- CHANGE LOG ---
// [May 13, 2026] CHANGED: Fetch activeSale + membership status once, pass to all ProductCards
// REASON: Prevents N+1 fetches — was previously fetched per-card which would cause 100+ API calls
// --- END CHANGE LOG ---

'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import ProductCard from './ProductCard'
import { fetchActiveSale } from '@/lib/activeSale'

// May 13, 2026 REASON: Single instance — not recreated on every render
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CATEGORIES = ['All', 'tshirts', 'hoodies', 'mugs', 'accessories']

export default function ShopClient({ products }: { products: any[] }) {
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')

  // May 13, 2026 REASON: Active sale + membership fetched once here, not per ProductCard
  const [activeSale, setActiveSale] = useState<any>(null)
  const [isMember, setIsMember] = useState(false)

  useEffect(() => {
    // May 13, 2026 REASON: Fetch active sale once on mount — 60s module-level cache in lib/activeSale
    fetchActiveSale().then(setActiveSale).catch(() => setActiveSale(null))

    // May 13, 2026 REASON: onAuthStateChange — never getSession on mount (rule #10)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null

        if (!user) {
          // May 14, 2026 REASON: Explicit reset — never rely on initial state across auth events
          setIsMember(false)
          return
        }

        // May 14, 2026 FIX: maybeSingle() returns null on no row — .single() threw PGRST116
        // silently leaving isMember true for non-members
        const { data, error } = await supabase
          .from('memberships')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        setIsMember(!error && !!data)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  const filtered = products.filter(p => {
    const matchCat = activeCategory === 'All' || p.category?.toLowerCase().includes(activeCategory.toLowerCase())
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-heading font-bold text-primary mb-2">Shop</h1>
      <p className="text-text-slate mb-8">All products for healthcare professionals</p>

      {/* Search */}
      <input
        type="text"
        placeholder="Search products..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="input-field mb-6 max-w-md"
      />

      {/* Category Filter */}
      <div className="flex flex-wrap gap-3 mb-10">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-5 py-2 rounded-full font-medium text-sm transition-all ${
              activeCategory === cat
                ? 'bg-primary text-white'
                : 'bg-accent text-primary hover:bg-primary hover:text-white'
            }`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-text-slate text-sm mb-6">
        {filtered.length} product{filtered.length !== 1 ? 's' : ''} found
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-text-slate font-medium">No products found</p>
          <button
            onClick={() => { setActiveCategory('All'); setSearch('') }}
            className="btn-primary mt-4 inline-block"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* May 13, 2026 REASON: activeSale + isMember passed as props — fetched once above */}
          {filtered.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              isFirstCard={index === 0}
              activeSale={activeSale}
              isMember={isMember}
            />
          ))}
        </div>
      )}
    </div>
  )
}
