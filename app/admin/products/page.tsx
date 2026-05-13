// ============================================================
// FILE: app/admin/products/page.tsx
// PURPOSE: Admin product management — filter, sort, paginate, visibility toggle
// LAST CHANGED: May 13, 2026
// WHY IT EXISTS: Admin needs to manage product visibility and browse all products
// DEPENDENCIES: /api/admin/products
// ⚠️ DO NOT CHANGE: 10 products per page — pagination logic depends on this
// ⚠️ DO NOT CHANGE: credentials: 'include' on ALL fetch calls — required so
//   the admin_token cookie is sent with requests on Safari/iPad. Without it,
//   the JWT verify fails and returns 401 which the page treats as a load error.
// ============================================================

// --- CHANGE LOG ---
// [May 11, 2026] CREATED: Admin product management (Phase 3)
// [May 13, 2026] FIXED: Added credentials: 'include' to fetch calls
// REASON: Safari on iPad does not send cookies with fetch unless explicitly told to.
//   Without this, verifyAdmin() gets no token and returns false, causing 401.
//   The page catches the error and shows "Failed to load products" even though
//   Printify and the API are working perfectly.
// --- END CHANGE LOG ---

'use client'
import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'

const PRODUCTS_PER_PAGE = 10

type Visibility = 'public' | 'members_only' | 'hidden'

interface Product {
  id: string
  title: string
  description: string
  price: number
  image: string
  category: string
  tags: string[]
  variantCount: number
  createdAt: string
  visibility: Visibility
}

const VISIBILITY_OPTIONS: { value: Visibility; label: string; color: string }[] = [
  { value: 'public', label: '🌐 Public', color: 'bg-green-100 text-green-700' },
  { value: 'members_only', label: '⭐ Members Only', color: 'bg-amber-100 text-amber-700' },
  { value: 'hidden', label: '🚫 Hidden', color: 'bg-red-100 text-red-700' },
]

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [filterVisibility, setFilterVisibility] = useState<'all' | Visibility>('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [page, setPage] = useState(1)
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchProducts = async () => {
    setLoading(true)
    setError('')
    try {
      // [May 13, 2026] REASON: credentials: 'include' required for Safari/iPad.
      // Without it, the admin_token cookie is not sent and verifyAdmin() returns
      // false (401), causing the page to show "Failed to load products" even
      // though Printify and the API route are working correctly.
      const res = await fetch('/api/admin/products', {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setProducts(data.products || [])
    } catch (e: any) {
      setError('Failed to load products. Check Printify connection.')
    }
    setLoading(false)
  }

  useEffect(() => { fetchProducts() }, [])

  // Reset to page 1 on filter/search change
  useEffect(() => { setPage(1) }, [search, sortBy, filterVisibility, filterCategory])

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean)))
    return ['all', ...cats.sort()]
  }, [products])

  const filtered = useMemo(() => {
    let result = [...products]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    if (filterVisibility !== 'all') {
      result = result.filter(p => p.visibility === filterVisibility)
    }

    if (filterCategory !== 'all') {
      result = result.filter(p => p.category === filterCategory)
    }

    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'oldest':
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case 'price-high':
        result.sort((a, b) => b.price - a.price)
        break
      case 'price-low':
        result.sort((a, b) => a.price - b.price)
        break
      case 'name-az':
        result.sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'name-za':
        result.sort((a, b) => b.title.localeCompare(a.title))
        break
    }

    return result
  }, [products, search, sortBy, filterVisibility, filterCategory])

  const totalPages = Math.ceil(filtered.length / PRODUCTS_PER_PAGE)
  const paginated = filtered.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE)

  const updateVisibility = async (productId: string, visibility: Visibility) => {
    setUpdating(productId)
    try {
      // [May 13, 2026] REASON: credentials: 'include' required here too —
      // same Safari cookie issue applies to PATCH requests.
      const res = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, visibility }),
      })
      if (!res.ok) throw new Error('Failed')
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, visibility } : p))
    } catch {
      alert('Failed to update visibility')
    }
    setUpdating(null)
  }

  const visibilityCounts = useMemo(() => ({
    public: products.filter(p => p.visibility === 'public').length,
    members_only: products.filter(p => p.visibility === 'members_only').length,
    hidden: products.filter(p => p.visibility === 'hidden').length,
  }), [products])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary">Products</h1>
          <p className="text-text-slate text-sm mt-1">{products.length} total products from Printify</p>
        </div>
        <button
          onClick={fetchProducts}
          disabled={loading}
          className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {VISIBILITY_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilterVisibility(filterVisibility === opt.value ? 'all' : opt.value)}
            className={`card p-4 text-left transition-all ${filterVisibility === opt.value ? 'ring-2 ring-primary' : ''}`}
          >
            <p className="text-xs text-text-slate mb-1">{opt.label}</p>
            <p className="text-2xl font-bold text-primary">{visibilityCounts[opt.value]}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-slate" />
          <input
            type="text"
            placeholder="Search by name, category or tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary bg-white"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="price-high">Price: High to Low</option>
            <option value="price-low">Price: Low to High</option>
            <option value="name-az">Name: A–Z</option>
            <option value="name-za">Name: Z–A</option>
          </select>

          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary bg-white"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>

          <span className="text-sm text-text-slate self-center ml-auto">
            {filtered.length} product{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Products List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse flex gap-4">
              <div className="w-16 h-16 bg-slate-200 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-1/2" />
                <div className="h-3 bg-slate-200 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : paginated.length === 0 ? (
        <div className="card p-12 text-center text-text-slate">
          <p className="text-4xl mb-3">📦</p>
          <p className="font-medium">No products found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginated.map(product => {
            const visOpt = VISIBILITY_OPTIONS.find(v => v.value === product.visibility)!
            return (
              <div key={product.id} className="card p-4 flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
                  {product.image && (
                    <Image
                      src={product.image}
                      alt={product.title}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text-dark truncate">{product.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-sm text-primary font-bold">${product.price.toFixed(2)}</span>
                    <span className="text-xs text-text-slate">{product.category}</span>
                    <span className="text-xs text-text-slate">{product.variantCount} variants</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${visOpt.color}`}>
                      {visOpt.label}
                    </span>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <select
                    value={product.visibility}
                    onChange={e => updateVisibility(product.id, e.target.value as Visibility)}
                    disabled={updating === product.id}
                    className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-primary bg-white disabled:opacity-50"
                    aria-label={`Set visibility for ${product.title}`}
                  >
                    {VISIBILITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-xl border border-slate-200 hover:bg-accent disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {[...Array(totalPages)].map((_, i) => {
            const p = i + 1
            if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) {
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${
                    page === p
                      ? 'bg-primary text-white'
                      : 'border border-slate-200 hover:bg-accent text-text-dark'
                  }`}
                >
                  {p}
                </button>
              )
            }
            if (Math.abs(p - page) === 2) {
              return <span key={p} className="text-text-slate">…</span>
            }
            return null
          })}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-xl border border-slate-200 hover:bg-accent disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
