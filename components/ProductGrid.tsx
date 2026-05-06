'use client'
import { useEffect, useState } from 'react'
import ProductCard from './ProductCard'

const MOCK_PRODUCTS = [
  {
    id: '1', title: 'Medical Heartbeat Tee', price: 29.99,
    image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Medical+Tee',
    category: 'tshirts', description: 'Classic medical heartbeat design'
  },
  {
    id: '2', title: 'Doctor Life Hoodie', price: 49.99,
    image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Doctor+Hoodie',
    category: 'hoodies', description: 'Cozy hoodie for long shifts'
  },
  {
    id: '3', title: 'Stethoscope Mug', price: 19.99,
    image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Medico+Mug',
    category: 'mugs', description: 'Start your shift right'
  },
  {
    id: '4', title: 'Nurse Pride Tee', price: 27.99,
    image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Nurse+Tee',
    category: 'tshirts', description: 'For the heroes in scrubs'
  },
  {
    id: '5', title: 'Anatomy Poster Tee', price: 31.99,
    image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Anatomy+Tee',
    category: 'tshirts', description: 'Science meets style'
  },
  {
    id: '6', title: 'Med School Survivor', price: 45.99,
    image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Med+School',
    category: 'hoodies', description: 'You earned this'
  },
  {
    id: '7', title: 'Coffee & Patients Mug', price: 18.99,
    image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Coffee+Mug',
    category: 'mugs', description: 'Fueled by caffeine'
  },
  {
    id: '8', title: 'Real Medico Cap', price: 24.99,
    image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Medico+Cap',
    category: 'accessories', description: 'Rep the brand'
  },
]

interface Props {
  featured?: boolean
  category?: string
}

export default function ProductGrid({ featured, category }: Props) {
  const [products, setProducts] = useState(MOCK_PRODUCTS)

  useEffect(() => {
    let filtered = MOCK_PRODUCTS
    if (featured) filtered = filtered.slice(0, 4)
    if (category) filtered = filtered.filter(p => p.category === category)
    setProducts(filtered)
  }, [featured, category])

  if (products.length === 0) {
    return (
      <div className="text-center py-16 text-text-slate">
        No products found.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
