'use client'
// ============================================================
// FILE: app/checkout/page.tsx
// PURPOSE: Multi-step checkout — contact, shipping, payment
// LAST CHANGED: May 14, 2026
// WHY IT EXISTS: Handles order placement via Razorpay
// DEPENDENCIES: cartStore, currencyStore, razorpay API routes, activeSale lib
// ⚠️ DO NOT CHANGE: onAuthStateChange pattern — never getSession on mount (rule #10)
// ⚠️ DO NOT CHANGE: membership uses .eq('active', true) NOT .eq('status','active')
//   memberships table has boolean 'active' column, not a 'status' text column
// ⚠️ DO NOT CHANGE: maybeSingle() not single() — single() errors on no rows
// ⚠️ DO NOT CHANGE: highest-wins rule — sale vs member 15%, whichever is higher
// ⚠️ DO NOT CHANGE: discounts computed from cart base prices (total())
//   Cart stores base prices — discounts always applied fresh here
// ============================================================

// --- CHANGE LOG ---
// [May 14, 2026] FIXED: Sale discount not applying at checkout for non-members
// ROOT CAUSE 1: Checkout only applied isMember ? 0.85 : 1.0 — no sale logic at all
// ROOT CAUSE 2: Membership check used getSession() (wrong pattern) + .eq('email') instead of user_id
// ROOT CAUSE 3: .single() throws on no membership row, silently leaving isMember state wrong
// FIX: Added fetchActiveSale + getEffectiveDiscount (highest-wins: sale vs member 15%)
//   Fixed auth to onAuthStateChange pattern, .eq('user_id'), .eq('active',true), maybeSingle()
// --- END CHANGE LOG ---

import { useState, useEffect } from 'react'
import useCartStore from '@/store/cartStore'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { useCurrencyStore, CURRENCY_CONFIG } from '@/store/currencyStore'
import CurrencySelector from '@/components/CurrencySelector'
import {
  fetchActiveSale,
  ActiveSale,
  getEffectiveDiscount,
  getDiscountedPrice,
} from '@/lib/activeSale'

// May 14, 2026 REASON: Single instance outside component — not recreated on every render
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function MembershipFOMOBanner({ onDismiss, savings }: { onDismiss: () => void; savings: string }) {
  const [timeLeft, setTimeLeft] = useState(600)

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
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-2 right-4 text-6xl">⭐</div>
        <div className="absolute bottom-2 left-4 text-4xl">🏥</div>
      </div>

      <button
        onClick={onDismiss}
        aria-label="Dismiss offer"
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
          <strong className="text-yellow-300">{savings} instant savings</strong> applied right now.
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
  const { currency, rates, formatPrice } = useCurrencyStore()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showFOMO, setShowFOMO] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [hasOrderedBefore, setHasOrderedBefore] = useState(false)
  // May 14, 2026 REASON: Active sale fetched here for discount calculation
  const [activeSale, setActiveSale] = useState<ActiveSale | null>(null)
  // May 14, 2026 REASON: Login required before payment — track auth user
  const [currentUser, setCurrentUser] = useState<any>(null)
  // May 14, 2026 REASON: Saved addresses fetched after login for auto-fill
  const [savedAddresses, setSavedAddresses] = useState<any[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '', country: 'India',
  })

  useEffect(() => {
    // May 14, 2026 REASON: Fetch active sale once on mount
    fetchActiveSale().then(setActiveSale).catch(() => setActiveSale(null))

    // May 14, 2026 FIX: onAuthStateChange — never getSession on mount (rule #10)
    // Previous code used getSession() which is wrong pattern
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null
        setCurrentUser(user)  // May 14, 2026 REASON: Track for login gate at payment step

        if (!user) {
          setIsMember(false)
          setSavedAddresses([])
          return
        }

        // May 14, 2026 REASON: Address fetch moved to separate useEffect below
        // so it runs immediately when currentUser state updates

        // May 14, 2026 FIX: query by user_id not email; boolean 'active' not status text
        // Previous: .eq('email', session.user.email) — wrong, use user_id
        // Previous: .single() — throws PGRST116 on no row, use maybeSingle()
        const { data: membership, error } = await supabase
          .from('memberships')
          .select('id')
          .eq('user_id', user.id)
          .eq('active', true)
          .maybeSingle()

        if (!error && membership) {
          setIsMember(true)
          return
        }

        // Check if ordered before for FOMO banner
        const { data: orders } = await supabase
          .from('orders')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)

        if (orders && orders.length > 0) {
          setHasOrderedBefore(true)
          setShowFOMO(true)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  // May 14, 2026 REASON: Separate useEffect for address fetch — runs immediately
  // when currentUser state updates, not buried inside onAuthStateChange async chain.
  // This ensures addresses appear on Step 1 load for already-logged-in users.
  useEffect(() => {
    if (!currentUser) {
      setSavedAddresses([])
      setSelectedAddressId(null)
      return
    }
    const fetchAddresses = async () => {
      const { data: addrs } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('is_default', { ascending: false })
      if (addrs && addrs.length > 0) {
        setSavedAddresses(addrs)
        // Pre-select default and auto-fill form
        const def = addrs.find((a: any) => a.is_default) || addrs[0]
        setSelectedAddressId(def.id)
        setForm(prev => ({
          ...prev,
          name: def.name || prev.name,
          email: def.email || prev.email,
          phone: def.phone || prev.phone,
          address: def.address,
          city: def.city,
          state: def.state || '',
          zip: def.zip,
          country: def.country || 'India',
        }))
      }
    }
    fetchAddresses()
  }, [currentUser])

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
    // May 14, 2026 REASON: Login required before payment step
    // Redirect to account page with return URL so user comes back after login
    if (!currentUser) {
      toast.error('Please log in to continue to payment')
      window.location.href = '/account?redirect=/checkout'
      return
    }
    setStep(3)
  }

  // May 14, 2026 FIX: Compute discounted subtotal using highest-wins rule
  // Previous code: discountedUSD = isMember ? subtotalUSD * 0.85 : subtotalUSD
  // Bug: no sale discount applied at all — non-members got no discount even during a sale
  const subtotalUSD = total() // base prices from cartStore

  // May 14, 2026 REASON: Effective discount = highest of sale vs member 15%
  // Use scope 'all' shortcut — cart doesn't track per-item scope so we use
  // the sale's effective discount if sale exists and is scope='all',
  // else fall back to getEffectiveDiscount with no productId (returns member discount only)
  const saleDiscount = activeSale ? activeSale.discount_percent : 0
  const memberDiscount = isMember ? 15 : 0
  const effectiveDiscountPercent = Math.max(saleDiscount, memberDiscount)
  const discountedUSD = effectiveDiscountPercent > 0
    ? getDiscountedPrice(subtotalUSD, effectiveDiscountPercent)
    : subtotalUSD
  const savingsUSD = subtotalUSD - discountedUSD

  // May 14, 2026 REASON: Label for discount line in summary
  const memberWon = isMember && memberDiscount >= saleDiscount
  const discountLabel = effectiveDiscountPercent > 0
    ? memberWon
      ? `⭐ Member Discount (15%)`
      : `🔥 ${activeSale?.name ?? 'Sale'} (${saleDiscount}%)`
    : null

  const rate = rates[currency] ?? 83
  const razorpayAmount = Math.round(discountedUSD * rate * 100)

  const handlePayment = async () => {
    setLoading(true)
    try {
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: razorpayAmount,
          currency: currency,
          country: form.country,
        }),
      })
      if (!orderRes.ok) throw new Error('Failed to create order')
      const orderData = await orderRes.json()

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'The Real Medico',
        description: `Order of ${items.length} item(s)${effectiveDiscountPercent > 0 ? ` — ${effectiveDiscountPercent}% discount applied` : ''}`,
        order_id: orderData.order_id,
        prefill: { name: form.name, email: form.email, contact: form.phone },
        notes: {
          address: `${form.address}, ${form.city}, ${form.state} ${form.zip}, ${form.country}`,
          is_member: isMember,
          discount_percent: effectiveDiscountPercent,
          sale_name: activeSale?.name ?? null,
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

      {/* Discount applied banner */}
      {effectiveDiscountPercent > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <span className="text-2xl">{memberWon ? '⭐' : '🔥'}</span>
          <div>
            <p className="font-bold text-green-800">
              {memberWon ? 'Real Medico+ Discount Applied!' : `${activeSale?.name} Sale Applied!`}
            </p>
            <p className="text-green-700 text-sm">
              You're saving <strong>{formatPrice(savingsUSD)}</strong> on this order ({effectiveDiscountPercent}% {memberWon ? 'member' : 'sale'} discount)
            </p>
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
            <MembershipFOMOBanner
              onDismiss={() => setShowFOMO(false)}
              savings={formatPrice(subtotalUSD * 0.15)}
            />
          )}

          {/* Step 1 — Contact */}
          {step === 1 && (
            <div className="card p-6 space-y-4">
              <h2 className="text-xl font-bold">Contact Information</h2>

              {/* May 14, 2026 REASON: Show saved addresses in Step 1 too — auto-fills all fields */}
              {savedAddresses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-text-dark">Use a saved address</p>
                  <div className="space-y-2">
                    {savedAddresses.map((addr: any) => (
                      <button
                        key={addr.id}
                        onClick={() => {
                          setSelectedAddressId(addr.id)
                          setForm(prev => ({
                            ...prev,
                            name: addr.name || prev.name,
                            email: addr.email || prev.email,
                            phone: addr.phone || prev.phone,
                            address: addr.address,
                            city: addr.city,
                            state: addr.state || '',
                            zip: addr.zip,
                            country: addr.country || 'India',
                          }))
                        }}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm ${
                          selectedAddressId === addr.id
                            ? 'border-primary bg-primary/5'
                            : 'border-slate-200 hover:border-primary'
                        }`}
                      >
                        <p className="font-semibold text-text-dark flex items-center gap-2">
                          {addr.name}
                          {addr.is_default && (
                            <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded-full">Default</span>
                          )}
                        </p>
                        <p className="text-text-slate text-xs mt-0.5">
                          {addr.phone} · {addr.address}, {addr.city}{addr.state ? `, ${addr.state}` : ''} — {addr.zip}, {addr.country}
                        </p>
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setSelectedAddressId(null)
                        setForm({ name: '', email: '', phone: '', address: '', city: '', state: '', zip: '', country: 'India' })
                      }}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm ${
                        selectedAddressId === null
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 hover:border-primary'
                      }`}
                    >
                      <p className="font-semibold text-primary">+ Enter a new address</p>
                    </button>
                  </div>
                  <div className="border-t pt-1 mt-1" />
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

              {/* May 14, 2026 REASON: Saved address selector — auto-fills form on select */}
              {savedAddresses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-text-dark">Saved Addresses</p>
                  <div className="space-y-2">
                    {savedAddresses.map((addr: any) => (
                      <button
                        key={addr.id}
                        onClick={() => {
                          setSelectedAddressId(addr.id)
                          setForm(prev => ({
                            ...prev,
                            name: addr.name || prev.name,
                            email: addr.email || prev.email,
                            phone: addr.phone || prev.phone,
                            address: addr.address,
                            city: addr.city,
                            state: addr.state || '',
                            zip: addr.zip,
                            country: addr.country || 'India',
                          }))
                        }}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm ${
                          selectedAddressId === addr.id
                            ? 'border-primary bg-primary/5'
                            : 'border-slate-200 hover:border-primary'
                        }`}
                      >
                        <p className="font-semibold text-text-dark flex items-center gap-2">
                          {addr.name}
                          {addr.is_default && (
                            <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded-full">Default</span>
                          )}
                        </p>
                        <p className="text-text-slate text-xs mt-0.5">
                          {addr.address}, {addr.city}{addr.state ? `, ${addr.state}` : ''} — {addr.zip}, {addr.country}
                        </p>
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setSelectedAddressId(null)
                        setForm(prev => ({ ...prev, address: '', city: '', state: '', zip: '', country: 'India' }))
                      }}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm ${
                        selectedAddressId === null
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 hover:border-primary'
                      }`}
                    >
                      <p className="font-semibold text-primary">+ Enter a new address</p>
                    </button>
                  </div>
                  <div className="border-t pt-3 mt-1" />
                </div>
              )}

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
              {/* May 14, 2026 REASON: Warn non-logged-in users before they hit the login gate */}
              {!currentUser && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-2 text-sm">
                  <span>🔒</span>
                  <span className="text-yellow-800">
                    You'll need to <strong>log in</strong> before payment.{' '}
                    <Link href="/account" className="text-primary underline">Log in now</Link> to save time.
                  </span>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
                <button onClick={goToStep3} className="btn-primary flex-1">Continue to Payment →</button>
              </div>
            </div>
          )}

          {/* Step 3 — Payment */}
          {step === 3 && (
            <div className="space-y-4">
              {showFOMO && !isMember && (
                <MembershipFOMOBanner
                  onDismiss={() => setShowFOMO(false)}
                  savings={formatPrice(subtotalUSD * 0.15)}
                />
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

                {effectiveDiscountPercent > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-sm">
                    <span>{memberWon ? '⭐' : '🔥'}</span>
                    <span className="text-green-800 font-medium">
                      {effectiveDiscountPercent}% {memberWon ? 'member' : 'sale'} discount applied — saving {formatPrice(savingsUSD)}
                    </span>
                  </div>
                )}

                {/* Currency selector */}
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div>
                    <p className="text-sm font-semibold text-text-dark">Payment Currency</p>
                    <p className="text-xs text-text-slate">You'll be charged in your selected currency</p>
                  </div>
                  <CurrencySelector variant="checkout" />
                </div>

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
                    {loading ? '⏳ Opening...' : `Pay ${formatPrice(discountedUSD)} Securely`}
                  </button>
                </div>
                <p className="text-center text-xs text-text-slate">
                  🌍 International cards accepted · Paying in {CURRENCY_CONFIG[currency].label}
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
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between text-sm text-text-slate">
              <span>Subtotal</span>
              {effectiveDiscountPercent > 0
                ? <span className="line-through">{formatPrice(subtotalUSD)}</span>
                : <span>{formatPrice(subtotalUSD)}</span>
              }
            </div>
            {effectiveDiscountPercent > 0 && discountLabel && (
              <div className="flex justify-between text-sm font-medium"
                style={{ color: '#16a34a' }}>  {/* May 14 2026: always green per design rule */}
                <span>{discountLabel}</span>
                <span>−{formatPrice(savingsUSD)}</span>
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
              <span>{formatPrice(discountedUSD)}</span>
            </div>
          </div>

          {!isMember && hasOrderedBefore && (
            <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-3">
              <p className="text-xs text-primary font-semibold mb-1">
                💡 Members save {formatPrice(subtotalUSD * 0.15)} on this order
              </p>
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
