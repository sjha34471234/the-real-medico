'use client'
import { useState } from 'react'
import useCartStore from '@/store/cartStore'
import toast from 'react-hot-toast'

export default function CheckoutPage() {
  const { items, total, clearCart } = useCartStore()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '', country: 'India',
  })

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const handlePayment = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: total(), items, customer: form }),
      })
      const data = await res.json()

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: 'INR',
        name: 'The Real Medico',
        description: 'Medical Merchandise Order',
        order_id: data.id,
        handler: async (response: any) => {
          await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...response, items, customer: form }),
          })
          clearCart()
          toast.success('Order placed successfully!')
          window.location.href = '/order-success'
        },
        prefill: { name: form.name, email: form.email, contact: form.phone },
        theme: { color: '#1A3A8F' },
      }
      const rzp = new (window as any).Razorpay(options)
      rzp.open()
    } catch {
      toast.error('Payment failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-heading font-bold text-primary mb-8">Checkout</h1>

      {/* Steps */}
      <div className="flex gap-4 mb-10">
        {['Contact', 'Shipping', 'Payment'].map((s, i) => (
          <div key={s} className={`flex items-center gap-2 text-sm font-medium ${step === i + 1 ? 'text-primary' : 'text-text-slate'}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === i + 1 ? 'bg-primary text-white' : step > i + 1 ? 'bg-success text-white' : 'bg-slate-200'}`}>
              {step > i + 1 ? '✓' : i + 1}
            </span>
            {s}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {/* Step 1 */}
          {step === 1 && (
            <div className="card p-6 space-y-4">
              <h2 className="text-xl font-bold mb-2">Contact Information</h2>
              <input name="name" placeholder="Full Name" value={form.name} onChange={update} className="input-field" />
              <input name="email" type="email" placeholder="Email" value={form.email} onChange={update} className="input-field" />
              <input name="phone" placeholder="Phone Number" value={form.phone} onChange={update} className="input-field" />
              <button onClick={() => setStep(2)} className="btn-primary w-full">Continue to Shipping</button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="card p-6 space-y-4">
              <h2 className="text-xl font-bold mb-2">Shipping Address</h2>
              <input name="address" placeholder="Street Address" value={form.address} onChange={update} className="input-field" />
              <input name="city" placeholder="City" value={form.city} onChange={update} className="input-field" />
              <div className="grid grid-cols-2 gap-4">
                <input name="state" placeholder="State" value={form.state} onChange={update} className="input-field" />
                <input name="zip" placeholder="ZIP Code" value={form.zip} onChange={update} className="input-field" />
              </div>
              <select name="country" value={form.country} onChange={update} className="input-field">
                <option>India</option>
                <option>United States</option>
                <option>United Kingdom</option>
                <option>Canada</option>
                <option>Australia</option>
              </select>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">Back</button>
                <button onClick={() => setStep(3)} className="btn-primary flex-1">Continue to Payment</button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="card p-6 space-y-4">
              <h2 className="text-xl font-bold mb-2">Payment</h2>
              <p className="text-text-slate text-sm">You will be redirected to Razorpay's secure payment page.</p>
              <div className="bg-accent rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl">🔒</span>
                <div>
                  <p className="font-medium text-sm">Secure Payment via Razorpay</p>
                  <p className="text-text-slate text-xs">UPI, Cards, Net Banking, Wallets accepted</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn-secondary flex-1">Back</button>
                <button onClick={handlePayment} disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Processing...' : `Pay ₹${(total() * 83).toFixed(0)}`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="card p-5 h-fit">
          <h3 className="font-bold mb-4">Order Summary</h3>
          <div className="space-y-3 mb-4">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3 items-center">
                <img src={item.image} className="w-12 h-12 rounded-lg object-cover" alt={item.title} />
                <div className="flex-1 text-sm">
                  <p className="font-medium line-clamp-1">{item.title}</p>
                  <p className="text-text-slate">Qty: {item.quantity}</p>
                </div>
                <span className="font-bold text-sm">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 flex justify-between font-bold text-primary">
            <span>Total</span>
            <span>${total().toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
