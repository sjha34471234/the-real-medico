// ============================================================
// FILE: components/SearchClient.tsx
// PURPOSE: Search UI + logs queries to search_logs via /api/search/log
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Customer search with analytics logging
// DEPENDENCIES: /api/search/log, Printify products (passed as props)
// ⚠️ DO NOT CHANGE: logSearch is fire-and-forget — never awaited, never blocks UX
// ⚠️ DO NOT CHANGE: 800ms debounce on logging — prevents logging every keystroke
// ⚠️ DO NOT CHANGE: searchParams must NOT use Promise<> — Next.js 14 syntax
// ============================================================

'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ProductCard from './ProductCard'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const SORT_OPTIONS = [
  { value: 'relevance', label: '⭐ Relevance' },
  { value: 'price-low', label: '💰 Price: Low to High' },
  { value: 'price-high', label: '💎 Price: High to Low' },
  { value: 'newest', label: '🆕 Newest First' },
  { value: 'oldest', label: '📅 Oldest First' },
  { value: 'rating', label: '⭐ Top Rated' },
]

const CATEGORIES = ['all', 'tshirts', 'hoodies', 'mugs', 'accessories', 'stickers']

// [May 11, 2026] REASON: Stable session ID for this browser session
// Used to group searches from same session in analytics
const SESSION_ID = typeof window !== 'undefined'
  ? (sessionStorage.getItem('trm_sid') || (() => {
      const id = Math.random().toString(36).slice(2)
      sessionStorage.setItem('trm_sid', id)
      return id
    })())
  : null

interface Product {
  id: string
  title: string
  description: string
  price: number
  image: string
  category: string
  rating: number
  reviewCount: number
  createdAt: string
  variants: any[]
}

interface Props {
  products: Product[]
  initialQuery: string
  initialSort: string
  initialCategory: string
}

export default function SearchClient({ products, initialQuery, initialSort, initialCategory }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [sort, setSort] = useState(initialSort)
  const [category, setCategory] = useState(initialCategory)
  const [showFilters, setShowFilters] = useState(false)
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })
  const [results, setResults] = useState<Product[]>([])

  // [May 11, 2026] REASON: debounce timer ref — logs search 800ms after user stops typing
  const logDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // [May 11, 2026] REASON: track last logged query to avoid duplicate logs
  const lastLoggedRef = useRef<string>('')

  const filterAndSort = useCallback(() => {
    let filtered = [...products]

    if (query.trim()) {
      const q = query.toLowerCase()
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      )
    }

    if (category !== 'all') {
      filtered = filtered.filter(p =>
        p.category.toLowerCase().includes(category.toLowerCase())
      )
    }

    if (priceRange.min) filtered = filtered.filter(p => p.price >= Number(priceRange.min))
    if (priceRange.max) filtered = filtered.filter(p => p.price <= Number(priceRange.max))

    switch (sort) {
      case 'price-low': filtered.sort((a, b) => a.price - b.price); break
      case 'price-high': filtered.sort((a, b) => b.price - a.price); break
      case 'newest': filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break
      case 'oldest': filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break
      case 'rating': filtered.sort((a, b) => b.rating - a.rating); break
      case 'relevance':
      default:
        if (query.trim()) {
          filtered.sort((a, b) => {
            const aTitle = a.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0
            const bTitle = b.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0
            return bTitle - aTitle
          })
        }
    }

    setResults(filtered)
    return filtered.length
  }, [products, query, sort, category, priceRange])

  useEffect(() => {
    const count = filterAndSort()

    // [May 11, 2026] REASON: Log search with 800ms debounce — fire-and-forget
    // Only logs when user pauses typing, prevents logging every keystroke
    // Never awaited — never blocks the search UI
    if (query.trim().length >= 2 && query.trim() !== lastLoggedRef.current) {
      if (logDebounceRef.current) clearTimeout(logDebounceRef.current)
      logDebounceRef.current = setTimeout(() => {
        lastLoggedRef.current = query.trim()
        // Get user ID if available (fire-and-forget, no await)
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        supabase.auth.getSession().then(({ data }) => {
          fetch('/api/search/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: query.trim(),
              resultCount: count,
              sessionId: SESSION_ID,
              userId: data.session?.user?.id || null,
            }),
          }).catch(() => {}) // Silent fail — never interrupt search
        })
      }, 800)
    }

    return () => {
      if (logDebounceRef.current) clearTimeout(logDebounceRef.current)
    }
  }, [filterAndSort, query])

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (sort !== 'relevance') params.set('sort', sort)
    if (category !== 'all') params.set('category', category)
    const newUrl = `/search${params.toString() ? '?' + params.toString() : ''}`
    router.replace(newUrl, { scroll: false })
  }, [query, sort, category, router])

  const clearSearch = () => {
    setQuery('')
    setSort('relevance')
    setCategory('all')
    setPriceRange({ min: '', max: '' })
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-primary mb-6">Search Products</h1>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-slate" />
          <input
            type="text"
            placeholder="Search medical merchandise..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
            className="w-full pl-12 pr-12 py-4 text-lg border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-primary transition-colors"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-slate hover:text-error">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="px-4 py-2 border-2 border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-primary bg-white">
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
              showFilters ? 'border-primary bg-primary text-white' : 'border-slate-200 hover:border-primary'
            }`}>
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>

          <span className="text-text-slate text-sm ml-auto">
            {results.length} result{results.length !== 1 ? 's' : ''}
            {query && <span className="font-medium text-primary"> for "{query}"</span>}
          </span>

          {(query || sort !== 'relevance' || category !== 'all' || priceRange.min || priceRange.max) && (
            <button onClick={clearSearch} className="text-sm text-error hover:underline">Clear all</button>
          )}
        </div>

        {showFilters && (
          <div className="mt-4 p-4 bg-accent rounded-2xl space-y-4">
            <div>
              <p className="text-sm font-semibold text-text-dark mb-2">Category</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      category === cat ? 'bg-primary text-white' : 'bg-white text-primary hover:bg-primary hover:text-white border border-primary'
                    }`}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-dark mb-2">Price Range (USD)</p>
              <div className="flex items-center gap-3">
                <input type="number" placeholder="Min $" value={priceRange.min}
                  onChange={e => setPriceRange({ ...priceRange, min: e.target.value })}
                  className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary bg-white" />
                <span className="text-text-slate">to</span>
                <input type="number" placeholder="Max $" value={priceRange.max}
                  onChange={e => setPriceRange({ ...priceRange, max: e.target.value })}
                  className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary bg-white" />
              </div>
            </div>
          </div>
        )}
      </div>

      {results.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-primary mb-2">No results found</h2>
          <p className="text-text-slate mb-6">
            {query ? `No products found for "${query}". Try a different search term.` : 'No products match your filters.'}
          </p>
          <button onClick={clearSearch} className="btn-primary inline-block">Clear Filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {results.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
