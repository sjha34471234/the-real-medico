// ============================================================
// FILE: components/ProductDetailClient.tsx
// PURPOSE: Client-side product detail page — image gallery, variant selector, add to cart
// LAST CHANGED: May 13, 2026
// WHY IT EXISTS: Renders product detail UI with state (selected variant, quantity, active image)
// DEPENDENCIES: cartStore, currencyStore, WishlistButton, ReviewSection, lib/activeSale.ts
// ⚠️ DO NOT CHANGE:
//   - next/image MUST be used for ALL images (main + thumbnails) — raw <img> caused 17.3s LCP
//   - Main image: fill + sizes="(max-width: 768px) 100vw, 50vw" — matches the md:grid 50% column
//   - Thumbnails: fill + sizes="80px" — fixed size, matches w-20 h-20 display
//   - Main image wrapper MUST have position:relative + explicit height — required for fill mode
//   - DO NOT add unoptimized prop — that disables Next.js optimization entirely
//   - Printify images from images-api.printify.com — already in next.config.js remotePatterns
//   - onAuthStateChange pattern for membership check (never getSession on mount)
//   - fetchActiveSale called once on mount — 60s module-level cache, no extra load
// ============================================================

// --- CHANGE LOG ---
// [May 11, 2026] CHANGED: Replaced all raw <img> tags with next/image
// REASON: Raw <img> tags bypassed Next.js image optimization entirely
// WHAT BROKE BEFORE: Printify serving 1200×1200px raw JPEGs (833 KiB each) with no cache TTL
//   → Mobile LCP 17.3s, Performance score 58
// OLD CODE WAS: <img src={mainImage} ...> and <img src={img} ...> in thumbnail map
// HOW THIS FIXES IT: next/image auto-converts to WebP/AVIF, resizes to displayed dimensions,
//   adds proper cache headers, and lazy-loads thumbnails while priority-loading the main image
// EXPECTED RESULT: Mobile LCP should drop from 17.3s to ~2-3s, score 58 → ~80+
//
// [May 13, 2026] CHANGED: Added sale/member strikethrough prices + % OFF badge
// REASON: SALES+ system now active — product detail must reflect live discounts
// HOW IT WORKS: fetchActiveSale (60s cached) + onAuthStateChange membership check
//   → getEffectiveDiscount picks highest-wins (sale vs member 15%)
//   → Shows strikethrough original, red discounted price, colored badge
// --- END CHANGE LOG ---

'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import useCartStore from '@/store/cartStore'
import toast from 'react-hot-toast'
import WishlistButton from './WishlistButton'
import ReviewSection from './ReviewSection'
import { useCurrencyStore } from '@/store/currencyStore'
import {
  fetchActiveSale,
  getEffectiveDiscount,
  getDiscountedPrice,
  isProductInSale,
} from '@/lib/activeSale'

// May 13, 2026 REASON: Single instance — not recreated on every render
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ProductDetailClient({ product }: { product: any }) {
  const [selectedVariant, setSelectedVariant] = useState(product.variants?.[0])
  const [quantity, setQuantity] = useState(1)
  const [mainImage, setMainImage] = useState(product.image)
  const addItem = useCartStore(s => s.addItem)
  const { formatPrice } = useCurrencyStore()

  // May 13, 2026 REASON: Active sale + membership for discount display
  const [activeSale, setActiveSale] = useState<any>(null)
  const [isMember, setIsMember] = useState(false)

  useEffect(() => {
    // May 13, 2026 REASON: Fetch active sale once on mount — 60s module-level cache in lib/activeSale
    fetchActiveSale().then(setActiveSale).catch(() => setActiveSale(null))

    // May 13, 2026 REASON: onAuthStateChange — never getSession on mount (rule #10)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null

        if (!user) {
          // May 14, 2026 REASON: Explicit reset — must set false here, not rely on initial state
          // Without this, a logged-out user could inherit isMember=true from a previous auth event
          setIsMember(false)
          return
        }

        // May 14, 2026 FIX: maybeSingle() returns null when no row exists (no error thrown)
        // .single() was throwing PGRST116 "no rows" error which was being silently swallowed,
        // leaving isMember unchanged (true) from a previous render cycle
        const { data, error } = await supabase
          .from('memberships')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        // May 14, 2026 REASON: Explicit false on error or no row — never assume membership
        setIsMember(!error && !!data)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  const currentPrice = selectedVariant?.price || product.price

  // May 13, 2026 REASON: Compute effective discount — highest-wins (sale vs member 15%)
  const effectiveDiscount = getEffectiveDiscount(activeSale, isMember, product.id, product.category)
  const discountedPrice = effectiveDiscount > 0
    ? getDiscountedPrice(currentPrice, effectiveDiscount)
    : null
  const hasDiscount = discountedPrice !== null && discountedPrice < currentPrice

  // May 13, 2026 REASON: Badge — sale name wins if sale discount >= member 15%
  // May 14, 2026 FIX: Always show the actual effectiveDiscount% in badge.
  // Bug: saleWins = sale.discount_percent >= 15 was false for a 10% sale,
  // so badge fell through to "15% OFF / Member Discount" for ALL users
  // including logged-out visitors who have no membership.
  // Fix: label = effectiveDiscount%. "Member Discount" subtitle ONLY when
  // isMember=true AND member 15% actually beat the sale discount.
  const saleApplies = activeSale && isProductInSale(activeSale, product.id, product.category)
  const saleDiscount = saleApplies ? activeSale.discount_percent : 0
  const memberWon = isMember && 15 > saleDiscount
  const badgeLabel = hasDiscount ? `${effectiveDiscount}% OFF` : null
  const badgeBg = hasDiscount
    ? memberWon
      ? '#ef4444'
      : activeSale?.color || '#ef4444'
    : null
  const badgeSub = hasDiscount && saleApplies && !memberWon && activeSale.name
    ? activeSale.name
    : hasDiscount && memberWon
    ? 'Member Discount'
    : null

  const handleAddToCart = () => {
    addItem({
      id: `${product.id}-${selectedVariant?.id}-${Date.now()}`,
      productId: product.id,
      variantId: String(selectedVariant?.id || 'default'),
      title: product.title,
      image: mainImage,
      // May 13, 2026 REASON: Add discounted price to cart if discount active
      price: hasDiscount ? discountedPrice! : currentPrice,
      size: selectedVariant?.title || 'M',
      quantity,
    })
    toast.success('Added to cart!')
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Link href="/shop" className="text-primary text-sm hover:underline mb-6 inline-block">
        ← Back to Shop
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Images */}
        <div className="space-y-3">

          {/* [May 11, 2026] REASON: position:relative + explicit height required for next/image fill mode */}
          <div className="relative w-full h-96 rounded-2xl overflow-hidden border border-slate-100">
            <Image
              src={mainImage}
              alt={product.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>

          {product.images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {product.images.slice(0, 6).map((img: string, i: number) => (
                // [May 11, 2026] REASON: Wrapped in relative div — next/image fill requires positioned parent
                <div
                  key={i}
                  onClick={() => setMainImage(img)}
                  className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                    mainImage === img ? 'border-primary' : 'border-transparent hover:border-primary'
                  }`}
                >
                  <Image
                    src={img}
                    alt={`view ${i + 1}`}
                    fill
                    sizes="80px"
                    className="object-cover rounded-lg"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-heading font-bold text-text-dark mb-3">
              {product.title}
            </h1>

            {/* May 13, 2026 REASON: Price block — strikethrough + discounted price + badge when active */}
            {hasDiscount ? (
              <div className="flex items-start gap-3">
                <div>
                  <p className="text-gray-400 line-through text-lg leading-tight">
                    {formatPrice(currentPrice)}
                  </p>
                  <p className="text-3xl font-bold text-red-500 leading-tight">
                    {formatPrice(discountedPrice!)}
                  </p>
                </div>
                {/* Badge — sale name/color or red member badge */}
                <div
                  className="flex flex-col items-center justify-center text-white rounded-xl px-3 py-2 shadow-md min-w-[72px]"
                  style={{ backgroundColor: badgeBg! }}
                >
                  <span className="text-base font-black leading-none">{badgeLabel}</span>
                  {badgeSub && (
                    <span className="text-[10px] font-medium leading-tight text-white/90 text-center mt-0.5">
                      {badgeSub}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-3xl font-bold text-primary">
                {formatPrice(currentPrice)}
              </p>
            )}
          </div>

          <div
            className="text-text-slate leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: product.description || 'Premium quality medical merchandise.' }}
          />

          {/* Variants */}
          {product.variants?.length > 0 && (
            <div>
              <p className="font-semibold mb-3">
                Size: <span className="text-primary">{selectedVariant?.title}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    disabled={!v.available}
                    aria-label={`Select size ${v.title}`}
                    className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
                      selectedVariant?.id === v.id
                        ? 'border-primary bg-primary text-white'
                        : v.available
                        ? 'border-slate-200 hover:border-primary'
                        : 'border-slate-100 text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    {v.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="flex items-center gap-4">
            <p className="font-semibold">Quantity:</p>
            <div className="flex items-center gap-3 border rounded-lg px-3 py-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                aria-label="Decrease quantity"
                className="font-bold text-lg w-6"
              >-</button>
              <span className="w-8 text-center font-bold">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                aria-label="Increase quantity"
                className="font-bold text-lg w-6"
              >+</button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button onClick={handleAddToCart} className="btn-primary flex-1">
              Add to Cart
            </button>
            <WishlistButton product={{
              id: product.id,
              title: product.title,
              image: mainImage,
              price: hasDiscount ? discountedPrice! : currentPrice,
            }} />
          </div>
          <Link href="/cart" className="btn-secondary w-full text-center block">
            View Cart
          </Link>

          {/* Shipping info */}
          <div className="bg-accent rounded-xl p-4 space-y-2 text-sm text-text-slate">
            <p>🚚 Free shipping on orders over {formatPrice(24)}</p>
            <p>🖨️ Printed on demand — ships in 3-5 business days</p>
            <p>↩️ 30-day return policy</p>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <ReviewSection productId={product.id} />
    </div>
  )
}
