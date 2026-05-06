'use client'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import useCartStore from '@/store/cartStore'
import toast from 'react-hot-toast'

interface Product {
  id: string
  title: string
  price: number
  image: string
  category: string
  description: string
}

export default function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem)

  const handleAddToCart = () => {
    addItem({
      id: `${product.id}-M`,
      productId: product.id,
      variantId: 'default',
      title: product.title,
      image: product.image,
      price: product.price,
      size: 'M',
      quantity: 1,
    })
    toast.success(`${product.title} added to cart!`)
  }

  return (
    <div className="card group hover:shadow-md transition-all duration-300">
      <div className="relative overflow-hidden">
        <img
          src={product.image}
          alt={product.title}
          className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <button
          onClick={handleAddToCart}
          className="absolute bottom-3 right-3 bg-primary text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-primary-dark"
        >
          <ShoppingCart className="w-5 h-5" />
        </button>
      </div>
      <div className="p-4">
        <Link href={`/shop/${product.id}`}>
          <h3 className="font-bold text-text-dark hover:text-primary transition-colors mb-1 line-clamp-1">
            {product.title}
          </h3>
        </Link>
        <p className="text-text-slate text-sm mb-3 line-clamp-1">{product.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-primary font-bold text-lg">${product.price}</span>
          <button
            onClick={handleAddToCart}
            className="text-sm btn-primary py-1.5 px-3"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  )
}
