'use client'
import Link from 'next/link'
import { ShoppingCart, Heart } from 'lucide-react'
import useCartStore from '@/store/cartStore'
import useWishlistStore from '@/store/wishlistStore'
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
  const { addItem: addToWishlist, removeItem: removeFromWishlist, isInWishlist } = useWishlistStore()
  const wishlisted = isInWishlist(product.id)

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

  const handleWishlist = () => {
    if (wishlisted) {
      removeFromWishlist(product.id)
      toast('Removed from wishlist', { icon: '💔' })
    } else {
      addToWishlist(product)
      toast.success('Added to wishlist! ❤️')
    }
  }

  return (
    <div className="card group hover:shadow-md transition-all duration-300">
      <div className="relative overflow-hidden">

        {/* Clicking image goes to product page */}
        <Link href={`/shop/${product.id}`}>
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
          />
        </Link>

        {/* Wishlist button — top right, always visible */}
        <button
          onClick={handleWishlist}
          className={`absolute top-3 right-3 p-2 rounded-lg shadow-lg transition-all ${
            wishlisted
              ? 'bg-red-500 text-white'
              : 'bg-white text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100'
          }`}
          title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={`w-4 h-4 ${wishlisted ? 'fill-white' : ''}`} />
        </button>

        {/* Add to cart button — bottom right on hover */}
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
