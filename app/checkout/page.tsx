'use client'
import { useState, useEffect } from 'react'
import useCartStore from '@/store/cartStore'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function MembershipFOMOBanner({ onDismiss }: { onDismiss: () => void }) {
  const [timeLeft, setTimeLeft] = useState(600) // 10 min countdown

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timer); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60

  return (
    <div className="relative bg-gradient-to-r from-primary to-primary-dark text-white rounded-2xl p-5 mb-6 overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-2 right-4 text-6xl">⭐</div>
        <div className="absolute bottom-2 left-4 text-4xl">🏥</div>
      </div>

      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-white/60 hover:text-white text-xl leading-none"
      >
        ×
      </button>

      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-yellow-400 text-yellow-900 text-xs font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
            Limited Offer
          </span>
          <span className="text-yellow-300 text-sm font-bold">
            ⏱ {mins}:{secs.toString().padStart(2, '0')} left
          </span>
        </div>

        <h3 className="text-xl font-heading font-black mb-1">
          You're one step away from saving more. 👨‍⚕️
        </h3>
        <p className="text-blue-100 text-sm mb-4">
          Real Medico+ members save <strong className="text-yellow-300">15% on this order</strong> — that's{' '}
          <strong className="text-yellow-300">instant savings</strong> applied right now.
          Plus <strong className="text-yellow-300">free shipping forever</strong>.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            { icon: '💰', text: '15% off every order' },
            { icon: '🚚', text: 'Free shipping always' },
            { icon: '⚡', text: 'Early product access' },
            { icon: '👑', text: 'Priority support' },
          ].map(b => (
            <div key={b.text} className="bg-white/10 rounded-lg px-2 py-2 text-center">
              <div className="text-lg">{b.icon}</div>
              <div className="text-xs text-blue-100 mt-0.5">{b.text}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/account#membership"
            className="bg-yellow-400 text-yellow-900 font-black px-6 py-2.5 rounded-xl hover:bg-yellow-300 transition-all text-sm"
          >
            Join Real Medico+ — ₹415/mo →
          </Link>
          <button
            onClick={onDismiss}
            className="text-blue-200 text-sm hover:text-white transition-colors"
          >
            Continue without saving
          </button>
        </div>

        <p className="text-blue-200 text-xs mt-2">
          Cancel anytime. Joins 100s of healthcare professionals already saving.
        </p>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  const { items, total, clearCart } = useCartStore()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showFOMO, setShowFOMO] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [hasOrderedBefore, setHasOrderedBefore] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '', country: 'India',
  })

  useEffect(() => {
    const checkUser = async () => {
      try {
        const supabase = getSupabase()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return

        // Check membership
        const { data: membership } = await supabase
          .from('memberships')
          .select('active')
          .eq('email', session.user.email)
          .eq('active', true)
          .single()

        if (membership) {
          setIsMember(true)
          return
        }

        // Check past orders
        const { data: orders } = await supabase
          .from('orders')
          .select('id')
          .eq('user_id', session.user.id)
          .limit(1)

        if (orders && orders.length > 0) {
          setHasOrderedBefore(true)
          setShowFOMO(true)
        }
      } catch (e) {
        console.error(e)
      }
    }
    checkUser()
  }, [])

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const goToStep2 = () => {
    if (!form.name.trim()) { toast.error('Please enter your full name'); return }
    if (!form.email.trim() || !form.email.includes('@')) { toast.error('Please enter a valid email'); return }
    if (!form.phone.trim() || form.phone.length < 7) { toast.error('Please enter a valid phone number'); return }
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
      const orderTotal = isMember ? total() * 0.85 : total()
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: orderTotal * 83 }),
      })
      if (!orderRes.ok) throw new Error('Failed to create order')
      const orderData = await orderRes.json()

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'The Real Medico',
        description: `Order of ${items.length} item(s)${isMember ? ' — 15% Member Discount Applied' : ''}`,
        order_id: orderData.order_id,
        prefill: { name: form.name, email: form.email, contact: form.phone },
        notes: {
          address: `${form.address}, ${form.city}, ${form.state} ${form.zip}, ${form.country}`,
          is_member: isMember,
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
    } catch {
      setLoading(false)
      toast.error('Something went wrong. Please try again.')
    }
  }

  const discountedTotal = isMember ? total() * 0.85 : total()
  const savings = isMember ? total() * 0.15 : 0

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

      {/* Member savings banner */}
      {isMember && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <span className="text-2xl">⭐</span>
          <div>
            <p className="font-bold text-green-800">Real Medico+ Discount Applied!</p>
            <p className="text-green-700 text-sm">You're saving <strong>${savings.toFixed(2)}</strong> on this order (15% member discount)</p>
          </div>
        </div>
      )}

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
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

          {/* FOMO Banner — Step 1 */}
          {step === 1 && showFOMO && !isMember && (
            <MembershipFOMOBanner onDismiss={() => setShowFOMO(false)} />
          )}

          {/* Step 1 — Contact */}
          {step === 1 && (
            <div className="card p-6 space-y-4">
              <h2 className="text-xl font-bold">Contact Information</h2>
              <div>
                <label className="text-sm font-medium text-text-slate mb-1 block">Full Name *</label>
                <input name="name" placeholder="Dr. John Smith" value={form.name} onChange={update} className="input-field" />
              </div>
              <div>
                <label className="text-sm font-medium text-text-slate mb-1 block">Email Address *</label>
                <input name="email" type="email" placeholder="john@hospital.com" value={form.email} onChange={update} className="input-field" />
              </div>
              <div>
                <label className="text-sm font-medium text-text-slate mb-1 block">Phone Number *</label>
                <input name="phone" placeholder="+1 234 567 8900" value={form.phone} onChange={update} className="input-field" />
              </div>
              <button onClick={goToStep2} className="btn-primary w-full mt-2">
                Continue to Shipping →
              </button>
            </div>
          )}

          {/* Step 2 — Shipping */}
          {step === 2 && (
            <div className="card p-6 space-y-4">
              <h2 className="text-xl font-bold">Shipping Address</h2>
              <div>
                <label className="text-sm font-medium text-text-slate mb-1 block">Street Address *</label>
                <input name="address" placeholder="123 Medical Street" value={form.address} onChange={update} className="input-field" />
              </div>
              <div>
                <label className="text-sm font-medium text-text-slate mb-1 block">City *</label>
                <input name="city" placeholder="New York" value={form.city} onChange={update} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-text-slate mb-1 block">State / Province</label>
                  <input name="state" placeholder="NY" value={form.state} onChange={update} className="input-field" />
                </div>
                <div>
                  <label className="text-sm font-medium text-text-slate mb-1 block">ZIP / Postal Code *</label>
                  <input name="zip" placeholder="10001" value={form.zip} onChange={update} className="input-field" />
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
                  <option>Germany</option>
                  <option>France</option>
                  <option>UAE</option>
                  <option>Singapore</option>
                  <option>New Zealand</option>
                  <option>South Africa</option>
                  <option>Malaysia</option>
                  <option>Other</option>
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
            <div className="space-y-4">
              {/* FOMO Banner — Step 3 */}
              {showFOMO && !isMember && (
                <MembershipFOMOBanner onDismiss={() => setShowFOMO(false)} />
              )}

              <div className="card p-6 space-y-4">
                <h2 className="text-xl font-bold">Payment</h2>
                <div className="bg-accent rounded-xl p-4 space-y-1 text-sm">
                  <p className="font-semibold text-text-dark">Delivering to:</p>
                  <p className="text-text-slate">{form.name} · {form.phone}</p>
                  <p className="text-text-slate">{form.address}, {form.city} {form.zip}, {form.country}</p>
                  <p className="text-text-slate">{form.email}</p>
                  <button onClick={() => setStep(1)} className="text-primary text-xs hover:underline mt-1">
                    Edit details
                  </button>
                </div>

                {isMember && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-sm">
                    <span>⭐</span>
                    <span className="text-green-800 font-medium">
                      15% Real Medico+ discount applied — saving ${savings.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
                  <span className="text-3xl">🔒</span>
                  <div>
                    <p className="font-semibold text-sm">Secure Payment via Razorpay</p>
                    <p className="text-text-slate text-xs mt-0.5">
                      UPI · Cards · Net Banking · Wallets · EMI · International Cards
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="btn-secondary flex-1">← Back</button>
                  <button
                    onClick={handlePayment}
                    disabled={loading}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {loading
                      ? '⏳ Opening...'
                      : `Pay $${discountedTotal.toFixed(2)} Securely`
                    }
                  </button>
                </div>
                <p className="text-center text-xs text-text-slate">
                  🌍 International cards accepted · Prices in USD
                </p>
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
                <span className="font-bold text-sm text-primary">
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between text-sm text-text-slate">
              <span>Subtotal</span>
              <span>${total().toFixed(2)}</span>
            </div>
            {isMember && (
              <div className="flex justify-between text-sm text-green-700 font-medium">
                <span>⭐ Member Discount (15%)</span>
                <span>-${savings.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-text-slate">
              <span>Shipping</span>
              <span className={isMember ? 'text-green-600 font-medium' : 'text-text-slate'}>
                {isMember ? '✅ Free (Member)' : 'Calculated at payment'}
              </span>
            </div>
            <div className="flex justify-between font-bold text-primary text-lg pt-1 border-t">
              <span>Total</span>
              <span>${discountedTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Mini FOMO in summary for non-members */}
          {!isMember && hasOrderedBefore && (
            <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-3">
              <p className="text-xs text-primary font-semibold mb-1">💡 Members save ${(total() * 0.15).toFixed(2)} on this order</p>
              <Link href="/account" className="text-xs text-primary underline">
                Join Real Medico+ →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
