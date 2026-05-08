'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function OrderSuccessContent() {
  const params = useSearchParams()
  const isCOD = params.get('method') === 'cod'

  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <div className="text-7xl mb-6">{isCOD ? '📦' : '🎉'}</div>
      <h1 className="text-4xl font-heading font-bold text-primary mb-4">
        Order Placed!
      </h1>
      {isCOD ? (
        <div className="space-y-3 mb-8">
          <p className="text-text-slate text-lg">
            Your order has been placed successfully!
          </p>
          <div className="card p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <p className="font-semibold mb-1">💵 Cash on Delivery</p>
            <p>Please keep the exact amount ready when your order arrives. A ₹50 COD fee is included.</p>
          </div>
        </div>
      ) : (
        <p className="text-text-slate text-lg mb-8">
          Thank you for your payment! Your order is confirmed and will be printed and shipped soon.
        </p>
      )}
      <div className="card p-4 text-sm text-text-slate mb-8 space-y-1">
        <p>📧 Confirmation email sent to your inbox</p>
        <p>🖨️ Printing begins within 24 hours</p>
        <p>📦 Estimated delivery: 8-15 business days</p>
        <p>🔍 Track your order from your Account page</p>
      </div>
      <div className="flex gap-4 justify-center">
        <Link href="/shop" className="btn-primary inline-block">
          Continue Shopping
        </Link>
        <Link href="/account" className="btn-secondary inline-block">
          My Orders
        </Link>
      </div>
    </div>
  )
}

export default function OrderSuccess() {
  return (
    <Suspense fallback={<div className="py-24 text-center">Loading...</div>}>
      <OrderSuccessContent />
    </Suspense>
  )
}
