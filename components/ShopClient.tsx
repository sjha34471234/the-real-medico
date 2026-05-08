'use client'
import { useState } from 'react'
import ProductCard from './ProductCard'

const CATEGORIES = ['All', 'tshirts', 'hoodies', 'mugs', 'accessories']

export default function ShopClient({ products }: { products: any[] }) {
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')

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
          {filtered.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
