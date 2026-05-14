// ============================================================
// FILE: components/ProductCard.tsx
// PURPOSE: Displays a product card with wishlist, add-to-cart, and sale/member discounted prices
// LAST CHANGED: May 13, 2026
// WHY IT EXISTS: Core product display component used in shop, home, trending, search pages
// DEPENDENCIES: cartStore, currencyStore, lib/activeSale.ts, supabase auth
// ⚠️ DO NOT CHANGE: onAuthStateChange pattern (never getUser on mount)
// ⚠️ DO NOT CHANGE: checkedFor ref — prevents duplicate wishlist DB calls
// ⚠️ DO NOT CHANGE: Single supabase instance outside component
// ============================================================

// --- CHANGE LOG ---
// [May 13, 2026] CHANGED: Added activeSale + isMember props for strikethrough discounted prices
// REASON: SALES+ system now active — product cards must reflect live discounts
// --- END CHANGE LOG ---

'use client'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart, Heart } from 'lucide-react'
import useCartStore from '@/store/cartStore'
import toast from 'react-hot-toast'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useCurrencyStore } from '@/store/currencyStore'
import {
  getEffectiveDiscount,
  getDiscountedPrice,
  isProductInSale,
} from '@/lib/activeSale'

// May 13, 2026 REASON: Single instance — not recreated on every render
const supabase = createClient(
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

// May 13, 2026 REASON: activeSale + isMember passed from parent (fetched once, not per-card)
export default function ProductCard({
  product,
  isFirstCard = false,
  activeSale = null,
  isMember = false,
}: {
  product: Product
  isFirstCard?: boolean
  activeSale?: any | null
  isMember?: boolean
}) {
  const addItem = useCartStore((s) => s.addItem)
  const [wishlisted, setWishlisted] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const { formatPrice } = useCurrencyStore()
  const checkedFor = useRef<string | null>(null)

  // May 13, 2026 REASON: Compute effective discount once — highest-wins rule (sale vs member 15%)
  const effectiveDiscount = getEffectiveDiscount(activeSale, isMember, product.id, product.category)
  const discountedPrice = effectiveDiscount > 0
    ? getDiscountedPrice(product.price, effectiveDiscount)
    : null
  const hasDiscount = discountedPrice !== null && discountedPrice < product.price

  // May 14, 2026 FIX: Badge label — show the ACTUAL effective discount percent.
  // Previous logic: saleWins = sale.discount_percent >= 15, else show "15% OFF"
  // Bug: when sale is 10% and user is NOT a member, saleWins=false so badge showed
  // "15% OFF / Member Discount" even though isMember=false and discount was from sale.
  // Fix: always show effectiveDiscount% in label. Show member label only if isMember
  // actually won (isMember=true AND memberDiscount > saleDiscount).
  const saleApplies = activeSale && isProductInSale(activeSale, product.id, product.category)
  const saleDiscount = saleApplies ? activeSale.discount_percent : 0
  const memberWon = isMember && 15 > saleDiscount  // member discount only wins if higher
  const badgeLabel = hasDiscount ? `${effectiveDiscount}% OFF` : null
  const badgeColor = hasDiscount
    ? memberWon
      ? '#ef4444'        // red for member discount
      : activeSale?.color || '#ef4444'  // sale color
    : null

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null
        setCurrentUser(user)

        if (user && checkedFor.current !== `${user.id}-${product.id}`) {
          checkedFor.current = `${user.id}-${product.id}`
          const { data } = await supabase
            .from('wishlist')
            .select('id')
            .eq('user_id', user.id)
            .eq('product_id', product.id)
            .single()
          setWishlisted(!!data)
        }

        if (!user) {
          setWishlisted(false)
          checkedFor.current = null
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [product.id])

  const handleAddToCart = () => {
    addItem({
      id: `${product.id}-M`,
      productId: product.id,
      variantId: 'default',
      title: product.title,
      image: product.image,
      // May 13, 2026 REASON: Add discounted price to cart if discount active
      price: hasDiscount ? discountedPrice! : product.price,
      size: 'M',
      quantity: 1,
    })
    toast.success(`${product.title} added to cart!`)
  }

  const handleWishlist = async () => {
    if (wishlistLoading) return

    if (!currentUser) {
      toast.error('Please log in to save to wishlist')
      return
    }

    setWishlistLoading(true)

    if (wishlisted) {
      const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('product_id', product.id)
      if (!error) {
        setWishlisted(false)
        toast('Removed from wishlist', { icon: '💔' })
      } else {
        toast.error('Could not remove from wishlist')
      }
    } else {
      const { error } = await supabase.from('wishlist').insert({
        user_id: currentUser.id,
        product_id: product.id,
        product_title: product.title,
        product_image: product.image,
        product_price: product.price,
      })
      if (!error) {
        setWishlisted(true)
        toast.success('Added to wishlist! ❤️')
      } else {
        toast.error('Could not save to wishlist')
      }
    }

    setWishlistLoading(false)
  }

  return (
    <div className="card group hover:shadow-md transition-all duration-300">
      <div className="relative overflow-hidden">

        {/* ✅ next/image replaces <img> — auto WebP/AVIF + correct sizing for mobile */}
        <Link href={`/shop/${product.id}`}>
          <div className="relative w-full h-56">
            <Image
              src={product.image}
              alt={product.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              priority={isFirstCard}
              className="object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
            />
          </div>
        </Link>

        {/* May 13, 2026 REASON: Discount badge — only shown when sale or member discount active */}
        {hasDiscount && badgeLabel && (
          <div
            className="absolute top-3 left-3 text-white text-xs font-bold px-2 py-1 rounded-md shadow-md"
            style={{ backgroundColor: badgeColor! }}
          >
            {badgeLabel}
          </div>
        )}

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

        {/* May 13, 2026 REASON: Price display — strikethrough original + discounted price when active */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            {hasDiscount ? (
              <>
                <span className="text-gray-400 line-through text-sm leading-tight">
                  {formatPrice(product.price)}
                </span>
                <span className="text-red-500 font-bold text-lg leading-tight">
                  {formatPrice(discountedPrice!)}
                </span>
              </>
            ) : (
              <span className="text-primary font-bold text-lg">
                {formatPrice(product.price)}
              </span>
            )}
          </div>
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
