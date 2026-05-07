'use client'
import { useState } from 'react'
import useCartStore from '@/store/cartStore'
import toast from 'react-hot-toast'
import Link from 'next/link'

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

  const goToStep2 = () => {
    if (!form.name.trim()) { toast.error('Please enter your full name'); return }
    if (!form.email.trim() || !form.email.includes('@')) { toast.error('Please enter a valid email'); return }
    if (!form.phone.trim() || form.phone.length < 10) { toast.error('Please enter a valid phone number'); return }
    setStep(2)
  }

  const goToStep3 = () => {
    if (!form.address.trim()) { toast.error('Please enter your street address'); return }
    if (!form.city.trim()) { toast.error('Please enter your city'); return }
    if (!form.zip.trim()) { toast.error('Please enter your ZIP/PIN code'); return }
    setStep(3)
  }

  const handlePayment = async () => {
    setLoading(true)
    try {
      const amountINR = total() * 83
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountINR }),
      })
      if (!orderRes.ok) throw new Error('Failed to create order')
      const orderData = await orderRes.json()

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'The Real Medico',
        description: `Order of ${items.length} item(s)`,
        order_id: orderData.order_id,
        prefill: {
          name: form.name,
          email: form.email,
          contact: form.phone,
        },
        notes: {
          address: `${form.address}, ${form.city}, ${form.state} ${form.zip}, ${form.country}`,
        },
        theme: { color: '#1A3A8F' },
        handler: async (response: any) => {
          const verifyRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...response, items, customer: form }),
          })
          const verifyData = await verifyRes.json()
          if (verifyData.verified) {
            clearCart()
            toast.success('Order placed successfully!')
            window.location.href = '/order-success'
          } else {
            toast.error('Payment verification failed')
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false)
            toast('Payment cancelled', { icon: 'ℹ️' })
          },
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.on('payment.failed', (response: any) => {
        setLoading(false)
        toast.error(`Payment failed: ${response.error.description}`)
      })
      rzp.open()
    } catch (err) {
      setLoading(false)
      toast.error('Something went wrong. Please try again.')
    }
  }

  if (items.length === 0) return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <div className="text-6xl mb-6">🛒</div>
      <h2 className="text-3xl font-heading font-bold text-primary mb-4">Your cart is empty</h2>
      <Link href="/shop" className="btn-primary inline-block">Browse Products</Link>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-heading font-bold text-primary mb-8">Checkout</h1>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-10">
        {['Contact', 'Shipping', 'Payment'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 text-sm font-medium ${step === i + 1 ? 'text-primary' : step > i + 1 ? 'text-success' : 'text-text-slate'}`}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step === i + 1 ? 'bg-primary text-white' : step > i + 1 ? 'bg-success text-white' : 'bg-slate-200 text-slate-500'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </span>
              <span className="hidden sm:block">{s}</span>
            </div>
            {i < 2 && <div className={`w-8 h-0.5 ${step > i + 1 ? 'bg-success' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">

          {/* Step 1 — Contact */}
          {step === 1 && (
            <div className="card p-6 space-y-4">
              <h2 className="text-xl font-bold mb-2">Contact Information</h2>
              <div>
                <label className="text-sm font-medium text-text-slate mb-1 block">Full Name *</label>
                <input name="name" placeholder="Dr. John Smith" value={form.name} onChange={update} className={`input-field ${!form.name ? 'border-slate-200' : 'border-success'}`} />
              </div>
              <div>
                <label className="text-sm font-medium text-text-slate mb-1 block">Email Address *</label>
                <input name="email" type="email" placeholder="john@hospital.com" value={form.email} onChange={update} className={`input-field ${!form.email ? 'border-slate-200' : 'border-success'}`} />
              </div>
              <div>
                <label className="text-sm font-medium text-text-slate mb-1 block">Phone Number *</label>
                <input name="phone" placeholder="+91 98765 43210" value={form.phone} onChange={update} className={`input-field ${!form.phone ? 'border-slate-200' : 'border-success'}`} />
              </div>
              <button onClick={goToStep2} className="btn-primary w-full mt-2">
                Continue to Shipping →
              </button>
            </div>
          )}

          {/* Step 2 — Shipping */}
          {step === 2 && (
            <div className="card p-6 space-y-4">
              <h2 className="text-xl font-bold mb-2">Shipping Address</h2>
              <div>
                <label className="text-sm font-medium text-text-slate mb-1 block">Street Address *</label>
                <input name="address" placeholder="123 Medical Colony" value={form.address} onChange={update} className={`input-field ${!form.address ? 'border-slate-200' : 'border-success'}`} />
              </div>
              <div>
                <label className="text-sm font-medium text-text-slate mb-1 block">City *</label>
                <input name="city" placeholder="Mumbai" value={form.city} onChange={update} className={`input-field ${!form.city ? 'border-slate-200' : 'border-success'}`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-text-slate mb-1 block">State</label>
                  <input name="state" placeholder="Maharashtra" value={form.state} onChange={update} className="input-field" />
                </div>
                <div>
                  <label className="text-sm font-medium text-text-slate mb-1 block">PIN Code *</label>
                  <input name="zip" placeholder="400001" value={form.zip} onChange={update} className={`input-field ${!form.zip ? 'border-slate-200' : 'border-success'}`} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-text-slate mb-1 block">Country</label>
                <select name="country" value={form.country} onChange={update} className="input-field">
                  <option>India</option>
                  <option>United States</option>
                  <option>United Kingdom</option>
                  <option>Canada</option>
                  <option>Australia</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
                <button onClick={goToStep3} className="btn-primary flex-1">Continue to Payment →</button>
              </div>
            </div>
          )}

          {/* Step 3 — Payment */}
          {step === 3 && (
            <div className="card p-6 space-y-4">
              <h2 className="text-xl font-bold mb-2">Payment</h2>
              <div className="bg-accent rounded-xl p-4 space-y-1 text-sm">
                <p className="font-semibold text-text-dark">Delivering to:</p>
                <p className="text-text-slate">{form.name} · {form.phone}</p>
                <p className="text-text-slate">{form.address}, {form.city} {form.zip}</p>
                <p className="text-text-slate">{form.email}</p>
                <button onClick={() => setStep(1)} className="text-primary text-xs hover:underline mt-1">Edit details</button>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
                <span className="text-3xl">🔒</span>
                <div>
                  <p className="font-semibold text-sm">Secure Payment via Razorpay</p>
                  <p className="text-text-slate text-xs mt-0.5">UPI · Cards · Net Banking · Wallets · EMI</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn-secondary flex-1">← Back</button>
                <button
                  onClick={handlePayment}
                  disabled={loading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {loading ? '⏳ Opening...' : `Pay ₹${(total() * 83).toFixed(0)} Securely`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="card p-5 h-fit sticky top-24">
          <h3 className="font-bold mb-4 text-lg">Order Summary</h3>
          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3 items-center">
                <img src={item.image} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" alt={item.title} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm line-clamp-1">{item.title}</p>
                  <p className="text-text-slate text-xs">Size: {item.size} · Qty: {item.quantity}</p>
                </div>
                <span className="font-bold text-sm text-primary">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between text-sm text-text-slate">
              <span>Subtotal (USD)</span>
              <span>${total().toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-text-slate">
              <span>Amount (INR ~)</span>
              <span>₹{(total() * 83).toFixed(0)}</span>
            </div>
            <div className="flex justify-between font-bold text-primary text-lg pt-1 border-t">
              <span>Total</span>
              <span>₹{(total() * 83).toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
