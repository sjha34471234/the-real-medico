'use client'
// ============================================================
// FILE: app/cart/page.tsx
// PURPOSE: Shopping cart page
// LAST CHANGED: May 12, 2026
// WHY IT EXISTS: Shows cart items, quantities, order summary
// DEPENDENCIES: cartStore, currencyStore, SaleCountdown, activeSale lib
// ⚠️ DO NOT CHANGE: 'use client' required — uses cartStore (Zustand)
// ⚠️ DO NOT CHANGE: fetchActiveSale is client-side here (no server fetch in client components)
// ============================================================

// --- CHANGE LOG ---
// [May 12, 2026] ADDED: fetchActiveSale + SaleCountdown above order summary (Phase 8)
// REASON: Cart page must show active sale countdown to encourage checkout
// --- END CHANGE LOG ---

import Link from 'next/link'
import { Trash2, Plus, Minus } from 'lucide-react'
import { useEffect, useState } from 'react'
import useCartStore from '@/store/cartStore'
import { useCurrencyStore } from '@/store/currencyStore'
import { fetchActiveSale, ActiveSale } from '@/lib/activeSale'
import SaleCountdown from '@/components/SaleCountdown'

export default function CartPage() {
  const { items, removeItem, updateQty, total } = useCartStore()
  const { formatPrice } = useCurrencyStore()

  // [May 12, 2026] REASON: Client-side fetch — cart page is 'use client', can't use server fetch
  const [sale, setSale] = useState<ActiveSale | null>(null)
  useEffect(() => { fetchActiveSale().then(setSale) }, [])

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

      {/* [May 12, 2026] REASON: Sale countdown above cart contents — full width, high visibility */}
      {sale && (
        <SaleCountdown sale={sale} variant="full" className="mb-6" />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
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
                      <p className="text-primary font-bold mt-1">{formatPrice(item.price)}</p>
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
                      = {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="card p-6 h-fit sticky top-24">
          <h2 className="text-xl font-bold mb-6">Order Summary</h2>
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-text-slate">
              <span>Subtotal ({items.reduce((a, i) => a + i.quantity, 0)} items)</span>
              <span>{formatPrice(total())}</span>
            </div>
            <div className="flex justify-between text-text-slate">
              <span>Shipping</span>
              <span className="text-success font-medium">Calculated at checkout</span>
            </div>
            <div className="border-t pt-3 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">{formatPrice(total())}</span>
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
