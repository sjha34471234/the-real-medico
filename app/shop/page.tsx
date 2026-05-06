'use client'
import { useState } from 'react'
import ProductGrid from '@/components/ProductGrid'

const CATEGORIES = ['All', 'tshirts', 'hoodies', 'mugs', 'accessories']

export default function ShopPage() {
  const [activeCategory, setActiveCategory] = useState('All')

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-heading font-bold text-primary mb-2">Shop</h1>
      <p className="text-text-slate mb-8">All products for healthcare professionals</p>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-3 mb-10">
        {CATEGORIES.map((cat) => (
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

      <ProductGrid category={activeCategory === 'All' ? undefined : activeCategory} />
    </div>
  )
}
