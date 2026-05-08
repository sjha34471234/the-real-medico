'use client'
import { useState, useEffect } from 'react'
import useCartStore from '@/store/cartStore'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
import toast from 'react-hot-toast'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

interface SavedAddress {
  id: string
  name: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  zip: string
  country: string
  is_default: boolean
}

// Must match the zones in create-order/route.ts
function getShippingCharge(country: string): number {
  const c = country?.toLowerCase().trim()
  if (!c || c === 'india') return 0
  const zone1 = ['nepal', 'bangladesh', 'sri lanka', 'bhutan', 'myanmar']
  if (zone1.includes(c)) return 299
  const zone2 = ['uae', 'singapore', 'malaysia', 'thailand', 'indonesia', 'philippines', 'vietnam', 'qatar', 'kuwait', 'bahrain', 'oman', 'saudi arabia']
  if (zone2.includes(c)) return 599
  const zone3 = ['united states', 'usa', 'us', 'united kingdom', 'uk', 'canada', 'australia', 'germany', 'france', 'netherlands', 'italy', 'spain', 'sweden', 'norway', 'denmark', 'finland', 'switzerland', 'austria', 'belgium', 'new zealand', 'ireland', 'portugal']
  if (zone3.includes(c)) return 899
  const zone4 = ['south africa', 'nigeria', 'kenya', 'ghana', 'brazil', 'argentina', 'mexico', 'colombia']
  if (zone4.includes(c)) return 1099
  return 999
}

export default function CheckoutPage() {
  const { items, total, clearCart } = useCartStore()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '', country: 'India',
  })

  const productTotal = total() * 83
  const shipping = getShippingCharge(form.country)
  const grandTotal = productTotal + shipping

  useEffect(() => {
    const loadAddresses = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
      if (data && data.length > 0) {
        setSavedAddresses(data)
        const def = data.find((a) => a.is_default) || data[0]
        setSelectedAddressId(def.id)
        setForm({
          name: def.name, email: def.email, phone: def.phone,
          address: def.address, city: def.city,
          state: def.state || '', zip: def.zip, country: def.country,
        })
      }
    }
    loadAddresses()
  }, [])

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const handleSelectAddress = (addr: SavedAddress) => {
    setSelectedAddressId(addr.id)
    setForm({
      name: addr.name, email: addr.email, phone: addr.phone,
      address: addr.address, city: addr.city,
      state: addr.state || '', zip: addr.zip, country: addr.country,
    })
  }

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
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: productTotal, country: form.country }),
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
        prefill: { name: form.name, email: form.email, contact: form.phone },
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
    } catch {
      setLoading(false)
      toast.error('Something went wrong. Please try again.')
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">🛒</div>
        <h2 className="text-3xl font-heading font-bold text-primary mb-4">Your cart is empty</h2>
        <Link href="/shop" className="btn-primary inline-block">Browse Products</Link>
      </div>
    )
  }

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
              <h2 className="text-xl font-bold">Contact Information</h2>
              {savedAddresses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-text-slate">Use a saved address:</p>
                  {savedAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      onClick={() => handleSelectAddress(addr)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm ${
                        selectedAddressId === addr.id
                          ? 'border-primary bg-blue-50'
                          : 'border-slate-200 hover:border-primary'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{addr.name}</span>
                        {selectedAddressId === addr.id && <CheckCircle className="w-4 h-4 text-primary" />}
                      </div>
                      <p className="text-text-slate text-xs mt-0.5">{addr.phone} · {addr.email}</p>
                      <p className="text-text-slate text-xs">{addr.address}, {addr.city} — {addr.zip}</p>
                    </button>
                  ))}
                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                    <div className="relative flex justify-center text-xs text-text-slate bg-white px-2 w-fit mx-auto">or fill manually</div>
                  </div>
                </div>
              )}
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
                <input name="phone" placeholder="+91 98765 43210" value={form.phone} onChange={update} className="input-field" />
              </div>
              <button onClick={goToStep2} className="btn-primary w-full mt-2">Continue to Shipping →</button>
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
                <input name="city" placeholder="Mumbai" value={form.city} onChange={update} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-text-slate mb-1 block">State</label>
                  <input name="state" placeholder="Maharashtra" value={form.state} onChange={update} className="input-field" />
                </div>
                <div>
                  <label className="text-sm font-medium text-text-slate mb-1 block">ZIP / PIN Code *</label>
                  <input name="zip" placeholder="400001" value={form.zip} onChange={update} className="input-field" />
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
                  <option>Malaysia</option>
                  <option>New Zealand</option>
                  <option>South Africa</option>
                  <option>Nepal</option>
                  <option>Bangladesh</option>
                  <option>Sri Lanka</option>
                  <option>Other</option>
                </select>
              </div>

              {/* Live shipping charge preview */}
              <div className={`rounded-xl p-3 text-sm flex items-center justify-between ${shipping === 0 ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                <span>🚚 Shipping to <strong>{form.country}</strong></span>
                <span className="font-bold">{shipping === 0 ? 'FREE' : `₹${shipping}`}</span>
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
              <h2 className="text-xl font-bold">Payment</h2>
              <div className="bg-accent rounded-xl p-4 space-y-1 text-sm">
                <p className="font-semibold text-text-dark">Delivering to:</p>
                <p className="text-text-slate">{form.name} · {form.phone}</p>
                <p className="text-text-slate">{form.address}, {form.city} {form.zip}, {form.country}</p>
                <p className="text-text-slate">{form.email}</p>
                <button onClick={() => setStep(1)} className="text-primary text-xs hover:underline mt-1">Edit details</button>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
                <span className="text-3xl">🔒</span>
                <div>
                  <p className="font-semibold text-sm">Secure Payment via Razorpay</p>
                  <p className="text-text-slate text-xs mt-0.5">UPI · Cards · Net Banking · Wallets · EMI · International Cards</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn-secondary flex-1">← Back</button>
                <button
                  onClick={handlePayment}
                  disabled={loading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {loading ? '⏳ Opening...' : `Pay ₹${grandTotal.toFixed(0)} Securely`}
                </button>
              </div>
              <p className="text-center text-xs text-text-slate">🌍 International cards accepted · Amount in INR</p>
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
                <span className="font-bold text-sm text-primary">₹{(item.price * item.quantity * 83).toFixed(0)}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between text-sm text-text-slate">
              <span>Subtotal</span>
              <span>₹{productTotal.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-sm text-text-slate">
              <span>Shipping ({form.country})</span>
              <span className={shipping === 0 ? 'text-green-600 font-medium' : ''}>
                {shipping === 0 ? 'FREE' : `₹${shipping}`}
              </span>
            </div>
            <div className="flex justify-between font-bold text-primary text-lg pt-1 border-t">
              <span>Total</span>
              <span>₹{grandTotal.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
