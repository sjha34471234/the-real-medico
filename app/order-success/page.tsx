import Link from 'next/link'

export default function OrderSuccess() {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <div className="text-7xl mb-6">🎉</div>
      <h1 className="text-4xl font-heading font-bold text-primary mb-4">Order Placed!</h1>
      <p className="text-text-slate text-lg mb-8">
        Thank you for your order. You will receive a confirmation email shortly. Your items will be printed and shipped soon!
      </p>
      <Link href="/shop" className="btn-primary inline-block">Continue Shopping</Link>
    </div>
  )
}
