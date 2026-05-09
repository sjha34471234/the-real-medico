'use client'
import Link from 'next/link'
import { ShoppingCart, Heart } from 'lucide-react'
import useCartStore from '@/store/cartStore'
import toast from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useCurrencyStore } from '@/store/currencyStore'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
  const [wishlisted, setWishlisted] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const { formatPrice } = useCurrencyStore()

  // Check if already wishlisted on mount
  useEffect(() => {
    const check = async () => {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('wishlist')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .single()
      if (data) setWishlisted(true)
    }
    check()
  }, [product.id])

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

  const handleWishlist = async () => {
    if (wishlistLoading) return
    setWishlistLoading(true)

    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast.error('Please log in to save to wishlist')
      setWishlistLoading(false)
      return
    }

    if (wishlisted) {
      await supabase
        .from('wishlist')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', product.id)
      setWishlisted(false)
      toast('Removed from wishlist', { icon: '💔' })
    } else {
      const { error } = await supabase.from('wishlist').insert({
        user_id: user.id,
        product_id: product.id,
        product_title: product.title,
        product_image: product.image,
        product_price: product.price,
      })
      if (error) {
        toast.error('Could not save to wishlist')
      } else {
        setWishlisted(true)
        toast.success('Added to wishlist! ❤️')
      }
    }
    setWishlistLoading(false)
  }

  return (
    <div className="card group hover:shadow-md transition-all duration-300">
      <div className="relative overflow-hidden">

        <Link href={`/shop/${product.id}`}>
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
          />
        </Link>

        <button
          onClick={handleWishlist}
          disabled={wishlistLoading}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute top-3 right-3 p-2 rounded-lg shadow-lg transition-all ${
            wishlisted
              ? 'bg-red-500 text-white'
              : 'bg-white text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100'
          }`}
        >
          <Heart className={`w-4 h-4 ${wishlisted ? 'fill-white' : ''}`} />
        </button>

        <button
          onClick={handleAddToCart}
          aria-label={`Add ${product.title} to cart`}
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
          <span className="text-primary font-bold text-lg">
            {formatPrice(product.price)}
          </span>
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
