'use client'
import { useEffect, useState } from 'react'
import ProductCard from './ProductCard'

const FALLBACK_PRODUCTS = [
  {
    id: '1', title: 'Medical Heartbeat Tee', price: 29.99,
    image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Medical+Tee',
    images: [], category: 'tshirts',
    description: 'Classic medical heartbeat design',
    variants: [{ id: 'default', title: 'M', price: 29.99, available: true }],
  },
  {
    id: '2', title: 'Doctor Life Hoodie', price: 49.99,
    image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Doctor+Hoodie',
    images: [], category: 'hoodies',
    description: 'Cozy hoodie for long shifts',
    variants: [{ id: 'default', title: 'M', price: 49.99, available: true }],
  },
  {
    id: '3', title: 'Stethoscope Mug', price: 19.99,
    image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Medico+Mug',
    images: [], category: 'mugs',
    description: 'Start your shift right',
    variants: [{ id: 'default', title: 'One Size', price: 19.99, available: true }],
  },
  {
    id: '4', title: 'Nurse Pride Tee', price: 27.99,
    image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Nurse+Tee',
    images: [], category: 'tshirts',
    description: 'For the heroes in scrubs',
    variants: [{ id: 'default', title: 'M', price: 27.99, available: true }],
  },
]

interface Props {
  featured?: boolean
  category?: string
}

export default function ProductGrid({ featured, category }: Props) {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/printify/products')
        const data = await res.json()

        let prods = data.products?.length > 0
          ? data.products
          : FALLBACK_PRODUCTS

        if (category) {
          prods = prods.filter((p: any) =>
            p.category?.toLowerCase().includes(category.toLowerCase())
          )
        }
        if (featured) prods = prods.slice(0, 4)

        setProducts(prods)
      } catch {
        let fallback = FALLBACK_PRODUCTS
        if (featured) fallback = fallback.slice(0, 4)
        setProducts(fallback)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [featured, category])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="w-full h-56 bg-slate-200" />
            <div className="p-4 space-y-3">
              <div className="h-4 bg-slate-200 rounded w-3/4" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
              <div className="h-8 bg-slate-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

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
