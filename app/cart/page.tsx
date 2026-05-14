'use client'
// ============================================================
// FILE: app/cart/page.tsx
// PURPOSE: Shopping cart page
// LAST CHANGED: May 14, 2026
// WHY IT EXISTS: Shows cart items, quantities, order summary
// DEPENDENCIES: cartStore, currencyStore, SaleCountdown, activeSale lib
// ⚠️ DO NOT CHANGE: 'use client' required — uses cartStore (Zustand)
// ⚠️ DO NOT CHANGE: Discounts applied HERE at display time, not at add-to-cart time
//   Cart always stores base price. This ensures discount is always current,
//   even if sale started/ended after item was added.
// ⚠️ DO NOT CHANGE: membership uses .eq('active', true) NOT .eq('status', 'active')
//   memberships table has boolean 'active' column, not a 'status' text column
// ⚠️ DO NOT CHANGE: maybeSingle() not single() — single() errors on no rows
// ============================================================

// --- CHANGE LOG ---
// [May 12, 2026] ADDED: fetchActiveSale + SaleCountdown above order summary (Phase 8)
// REASON: Cart page must show active sale countdown to encourage checkout
//
// [May 14, 2026] FIXED: Cart showing full prices for logged-out users and members
// ROOT CAUSE: Discounts were applied at add-to-cart time in ProductCard/ProductDetailClient.
//   If sale hadn't loaded yet when user clicked Add to Cart, item was stored at full price.
//   Members were also not getting 15% because cart just showed stored price.
// FIX: Cart now fetches active sale + membership itself and applies discount at display time.
//   cartStore still stores base price — discount is always computed fresh here.
//   This also means if a sale starts/ends after item was added, cart reflects it correctly.
// --- END CHANGE LOG ---

import Link from 'next/link'
import { Trash2, Plus, Minus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import useCartStore from '@/store/cartStore'
import { useCurrencyStore } from '@/store/currencyStore'
import {
  fetchActiveSale,
  ActiveSale,
  getEffectiveDiscount,
  getDiscountedPrice,
  isProductInSale,
} from '@/lib/activeSale'
import SaleCountdown from '@/components/SaleCountdown'

// May 14, 2026 REASON: Single instance outside component
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CartPage() {
  const { items, removeItem, updateQty, total } = useCartStore()
  const { formatPrice } = useCurrencyStore()

  const [sale, setSale] = useState<ActiveSale | null>(null)
  const [isMember, setIsMember] = useState(false)

  useEffect(() => {
    // May 14, 2026 REASON: Fetch active sale once on mount
    fetchActiveSale().then(setSale).catch(() => setSale(null))

    // May 14, 2026 REASON: onAuthStateChange — never getSession on mount (rule #10)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null
        if (!user) {
          setIsMember(false)
          return
        }
        // May 14, 2026 FIX: boolean 'active' column — NOT .eq('status', 'active')
        const { data, error } = await supabase
          .from('memberships')
          .select('id')
          .eq('user_id', user.id)
          .eq('active', true)
          .maybeSingle()
        setIsMember(!error && !!data)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  // May 14, 2026 REASON: Compute discounted price for a cart item fresh at display time.
  // Cart stores base price — discount always computed here so it reflects current sale/membership.
  function getItemDisplayPrice(item: any): number {
    const discount = getEffectiveDiscount(sale, isMember, item.productId, item.category)
    return discount > 0 ? getDiscountedPrice(item.price, discount) : item.price
  }

  // May 14, 2026 REASON: Discounted total computed fresh — not from stored prices
  function discountedTotal(): number {
    return items.reduce((sum, item) => sum + getItemDisplayPrice(item) * item.quantity, 0)
  }

  // May 14, 2026 REASON: Check if any discount is active for display in summary
  const hasAnyDiscount = items.some(item => getItemDisplayPrice(item) < item.price)
  const originalTotal = total() // base prices × quantities
  const finalTotal = discountedTotal()
  const totalSaving = originalTotal - finalTotal

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">🛒</div>
        <h2 className="text-3xl font-heading font-bold text-primary mb-4">Your cart is empty</h2>
        <p className="text-text-slate mb-8">Looks like you haven't added anything yet.</p>
        <Link href="/shop" className="btn-primary inline-block">Browse Products</Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-heading font-bold text-primary mb-8">Your Cart</h1>

      {/* Sale countdown */}
      {sale && (
        <SaleCountdown sale={sale} variant="full" className="mb-6" />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const displayPrice = getItemDisplayPrice(item)
            const hasDiscount = displayPrice < item.price
            return (
              <div key={item.id} className="card p-4">
                <div className="flex gap-4">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-text-dark leading-tight line-clamp-2">{item.title}</h3>
                        <p className="text-text-slate text-sm mt-0.5">Size: {item.size}</p>

                        {/* May 14, 2026 REASON: Show strikethrough + discounted price when discount active */}
                        {hasDiscount ? (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-gray-400 line-through text-sm">
                              {formatPrice(item.price)}
                            </span>
                            <span className="text-red-500 font-bold">
                              {formatPrice(displayPrice)}
                            </span>
                          </div>
                        ) : (
                          <p className="text-primary font-bold mt-1">{formatPrice(item.price)}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0 transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => updateQty(item.id, Math.max(1, item.quantity - 1))}
                        aria-label="Decrease quantity"
                        className="p-1.5 rounded-lg bg-accent hover:bg-slate-200 transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-bold w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.id, item.quantity + 1)}
                        aria-label="Increase quantity"
                        className="p-1.5 rounded-lg bg-accent hover:bg-slate-200 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <span className="text-text-slate text-sm ml-2">
                        = {formatPrice(displayPrice * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="card p-6 h-fit sticky top-24">
          <h2 className="text-xl font-bold mb-6">Order Summary</h2>
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-text-slate">
              <span>Subtotal ({items.reduce((a, i) => a + i.quantity, 0)} items)</span>
              {/* May 14, 2026 REASON: Show original total struck if discount active */}
              {hasAnyDiscount ? (
                <span className="line-through">{formatPrice(originalTotal)}</span>
              ) : (
                <span>{formatPrice(originalTotal)}</span>
              )}
            </div>

            {/* May 14, 2026 REASON: Show saving line when discount active */}
            {hasAnyDiscount && (
              <>
                <div className="flex justify-between text-red-500 font-medium">
                  <span>
                    {isMember && (!sale || sale.discount_percent < 15)
                      ? '⭐ Member Discount (15%)'
                      : sale
                      ? `🔥 ${sale.name}`
                      : 'Discount'}
                  </span>
                  <span>−{formatPrice(totalSaving)}</span>
                </div>
                <div className="flex justify-between text-text-slate">
                  <span>Discounted Subtotal</span>
                  <span className="text-red-500 font-bold">{formatPrice(finalTotal)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between text-text-slate">
              <span>Shipping</span>
              <span className="text-success font-medium">Calculated at checkout</span>
            </div>
            <div className="border-t pt-3 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">{formatPrice(finalTotal)}</span>
            </div>
          </div>
          <Link href="/checkout" className="btn-primary w-full text-center block">
            Proceed to Checkout
          </Link>
          <Link href="/shop" className="block text-center text-primary text-sm mt-4 hover:underline">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
