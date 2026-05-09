'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ProductCard from './ProductCard'
import { Search, SlidersHorizontal, X } from 'lucide-react'

const SORT_OPTIONS = [
  { value: 'relevance', label: '⭐ Relevance' },
  { value: 'price-low', label: '💰 Price: Low to High' },
  { value: 'price-high', label: '💎 Price: High to Low' },
  { value: 'newest', label: '🆕 Newest First' },
  { value: 'oldest', label: '📅 Oldest First' },
  { value: 'rating', label: '⭐ Top Rated' },
]

const CATEGORIES = ['all', 'tshirts', 'hoodies', 'mugs', 'accessories', 'stickers']

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

  const filterAndSort = useCallback(() => {
    let filtered = [...products]

    // Search filter
    if (query.trim()) {
      const q = query.toLowerCase()
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      )
    }

    // Category filter
    if (category !== 'all') {
      filtered = filtered.filter(p =>
        p.category.toLowerCase().includes(category.toLowerCase())
      )
    }

    // Price range filter
    if (priceRange.min) {
      filtered = filtered.filter(p => p.price >= Number(priceRange.min))
    }
    if (priceRange.max) {
      filtered = filtered.filter(p => p.price <= Number(priceRange.max))
    }

    // Sort
    switch (sort) {
      case 'price-low':
        filtered.sort((a, b) => a.price - b.price)
        break
      case 'price-high':
        filtered.sort((a, b) => b.price - a.price)
        break
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case 'rating':
        filtered.sort((a, b) => b.rating - a.rating)
        break
      case 'relevance':
      default:
        if (query.trim()) {
          filtered.sort((a, b) => {
            const aTitle = a.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0
            const bTitle = b.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0
            return bTitle - aTitle
          })
        }
        break
    }

    setResults(filtered)
  }, [products, query, sort, category, priceRange])

  useEffect(() => {
    filterAndSort()
  }, [filterAndSort])

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

      {/* Search Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-primary mb-6">
          Search Products
        </h1>

        {/* Search Input */}
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
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-text-slate hover:text-error"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Sort + Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Sort dropdown */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="px-4 py-2 border-2 border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-primary bg-white"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${showFilters ? 'border-primary bg-primary text-white' : 'border-slate-200 hover:border-primary'}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>

          {/* Results count */}
          <span className="text-text-slate text-sm ml-auto">
            {results.length} result{results.length !== 1 ? 's' : ''}
            {query && <span className="font-medium text-primary"> for "{query}"</span>}
          </span>

          {/* Clear all */}
          {(query || sort !== 'relevance' || category !== 'all' || priceRange.min || priceRange.max) && (
            <button onClick={clearSearch} className="text-sm text-error hover:underline">
              Clear all
            </button>
          )}
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-accent rounded-2xl space-y-4">
            {/* Categories */}
            <div>
              <p className="text-sm font-semibold text-text-dark mb-2">Category</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      category === cat
                        ? 'bg-primary text-white'
                        : 'bg-white text-primary hover:bg-primary hover:text-white border border-primary'
                    }`}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div>
              <p className="text-sm font-semibold text-text-dark mb-2">Price Range (USD)</p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  placeholder="Min $"
                  value={priceRange.min}
                  onChange={e => setPriceRange({ ...priceRange, min: e.target.value })}
                  className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary bg-white"
                />
                <span className="text-text-slate">to</span>
                <input
                  type="number"
                  placeholder="Max $"
                  value={priceRange.max}
                  onChange={e => setPriceRange({ ...priceRange, max: e.target.value })}
                  className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary bg-white"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-primary mb-2">No results found</h2>
          <p className="text-text-slate mb-6">
            {query
              ? `No products found for "${query}". Try a different search term.`
              : 'No products match your filters.'
            }
          </p>
          <button onClick={clearSearch} className="btn-primary inline-block">
            Clear Filters
          </button>
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
