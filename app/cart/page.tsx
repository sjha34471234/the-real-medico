'use client'
import Link from 'next/link'
import { Trash2, Plus, Minus } from 'lucide-react'
import useCartStore from '@/store/cartStore'

export default function CartPage() {
  const { items, removeItem, updateQty, total } = useCartStore()

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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="card p-4 flex gap-4 items-center">
              <img src={item.image} alt={item.title} className="w-20 h-20 rounded-lg object-cover" />
              <div className="flex-1">
                <h3 className="font-bold text-text-dark">{item.title}</h3>
                <p className="text-text-slate text-sm">Size: {item.size}</p>
                <p className="text-primary font-bold">${item.price}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQty(item.id, Math.max(1, item.quantity - 1))}
                  className="p-1 rounded-lg bg-accent hover:bg-slate-200"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-bold w-6 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQty(item.id, item.quantity + 1)}
                  className="p-1 rounded-lg bg-accent hover:bg-slate-200"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => removeItem(item.id)}
                className="p-2 text-error hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="card p-6 h-fit sticky top-24">
          <h2 className="text-xl font-bold mb-6">Order Summary</h2>
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-text-slate">
              <span>Subtotal</span>
              <span>${total().toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-text-slate">
              <span>Shipping</span>
              <span className="text-success font-medium">Calculated at checkout</span>
            </div>
            <div className="border-t pt-3 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">${total().toFixed(2)}</span>
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
