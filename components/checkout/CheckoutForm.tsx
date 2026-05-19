'use client'
// ============================================================
// FILE: components/checkout/CheckoutForm.tsx
// PURPOSE: All 3 checkout steps (contact, shipping, payment) + FOMO banner.
//   Owns form state, step navigation, and the Razorpay payment handler.
// LAST CHANGED: May 19, 2026
// WHY IT EXISTS: Extracted from app/checkout/page.tsx as part of modular refactor.
// DEPENDENCIES: cartStore, currencyStore, activeSale lib, AddressPicker component,
//   CouponInput component, /api/razorpay/validate-discount, /api/razorpay/create-order,
//   /api/razorpay/verify, /api/coupon/apply, react-hot-toast, next/link
// ⚠️ DO NOT CHANGE: handlePayment calls validate-discount FIRST to get signed token.
//   create-order only accepts validationToken — never a raw amount.
//   This is the tamper-prevention system. Do not bypass it.
// ⚠️ DO NOT CHANGE: discountedUSD / savingsUSD here are UI-only display values.
//   The actual charged amount is always what comes back in the HMAC-signed token.
// ⚠️ DO NOT CHANGE: When a coupon is applied it is the ONLY discount.
//   Sale + member discounts are zeroed out entirely. See discount calculation block.
// ⚠️ DO NOT CHANGE: applyCoupon is called AFTER verify succeeds — never before.
//   A failed payment must never burn a coupon.
// ⚠️ DO NOT CHANGE: accessToken is passed from parent (onAuthStateChange in page.tsx).
//   Do not read it from Supabase directly here — page.tsx owns auth state.
// ============================================================

// --- CHANGE LOG ---
// [May 17, 2026] REFACTORED: Split ~600-line monolith into shell + components/checkout/
// REASON: Modular architecture mandate — one file, one responsibility.
// [May 19, 2026] UPDATED: Wired CouponInput — coupon disables sale+member discounts.
//   applyCoupon called post-verify. Server re-validates coupon in validate-discount.
// REASON: Coupon system Tier 3 feature.
// --- END CHANGE LOG ---

import { useState, useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import useCartStore from '@/store/cartStore'
import { useCurrencyStore, CURRENCY_CONFIG } from '@/store/currencyStore'
import CurrencySelector from '@/components/CurrencySelector'
import { fetchActiveSale, ActiveSale, getDiscountedPrice } from '@/lib/activeSale'
import AddressPicker from './AddressPicker'
import CouponInput, { CouponResult } from './CouponInput'

// ── FOMO Banner ───────────────────────────────────────────────────────────────

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
          Real Medico+ members save{' '}
          <strong className="text-yellow-300">15% on this order</strong> — that's{' '}
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
          <button onClick={onDismiss} className="text-blue-200 text-sm hover:text-white transition-colors">
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

// ── CheckoutForm ──────────────────────────────────────────────────────────────

interface CheckoutFormProps {
  isMember: boolean
  hasOrderedBefore: boolean
  showFOMO: boolean
  onDismissFOMO: () => void
  accessToken: string | null
  savedAddresses: any[]
  currentUser: any
  onPaymentSuccess: () => void
}

export default function CheckoutForm({
  isMember,
  hasOrderedBefore,
  showFOMO,
  onDismissFOMO,
  accessToken,
  savedAddresses,
  currentUser,
  onPaymentSuccess,
}: CheckoutFormProps) {
  const { items } = useCartStore()
  const { currency, rates, formatPrice } = useCurrencyStore()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [activeSale, setActiveSale] = useState<ActiveSale | null>(null)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  // [May 19, 2026] REASON: Coupon state — null means no coupon applied.
  //   When set, it is the ONLY discount (sale + member both zeroed out).
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null)
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '', country: 'India',
  })

  useEffect(() => {
    // May 14, 2026 REASON: Fetch active sale once on mount for UI display only.
    // Server re-validates in validate-discount — this is display only.
    fetchActiveSale().then(setActiveSale).catch(() => setActiveSale(null))
  }, [])

  // May 17, 2026 REASON: Pre-fill form when savedAddresses load (default or first)
  useEffect(() => {
    if (savedAddresses.length > 0 && !form.address) {
      const def = savedAddresses.find(a => a.is_default) || savedAddresses[0]
      setSelectedAddressId(def.id)
      setForm(prev => ({
        ...prev,
        name:    def.name    || prev.name,
        email:   def.email   || prev.email,
        phone:   def.phone   || prev.phone,
        address: def.address,
        city:    def.city,
        state:   def.state   || '',
        zip:     def.zip,
        country: def.country || 'India',
      }))
    }
  }, [savedAddresses])

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const handleAddressSelect = (addr: any | null) => {
    if (!addr) {
      setSelectedAddressId(null)
      setForm(prev => ({ ...prev, address: '', city: '', state: '', zip: '', country: 'India' }))
      return
    }
    setSelectedAddressId(addr.id)
    setForm(prev => ({
      ...prev,
      name:    addr.name    || prev.name,
      email:   addr.email   || prev.email,
      phone:   addr.phone   || prev.phone,
      address: addr.address,
      city:    addr.city,
      state:   addr.state   || '',
      zip:     addr.zip,
      country: addr.country || 'India',
    }))
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
    if (!currentUser) {
      toast.error('Please log in to continue to payment')
      window.location.href = '/account?redirect=/checkout'
      return
    }
    setStep(3)
  }

  // ── UI-only discount calculation (display only — NOT what gets charged) ────
  // May 19, 2026 REASON: When a coupon is applied it is the ONLY discount.
  //   Sale + member discounts are zeroed out entirely.
  //   The actual charged amount always comes from the HMAC-signed token server-side.
  const { total } = useCartStore()
  const subtotalUSD = total()

  let effectiveDiscountPercent: number
  let discountedUSD:             number
  let savingsUSD:                number
  let memberWon:                 boolean
  let discountLabel:             string | null

  if (appliedCoupon) {
    // Coupon active — disables sale + member discounts entirely
    effectiveDiscountPercent = appliedCoupon.discountPercent
    discountedUSD = appliedCoupon.type === 'fixed'
      ? Math.max(0, subtotalUSD - appliedCoupon.discountUSD)
      : appliedCoupon.type === 'percent'
        ? subtotalUSD * (1 - appliedCoupon.discountPercent / 100)
        : subtotalUSD  // 'shipping' type — subtotal unchanged, benefit is free shipping
    savingsUSD    = subtotalUSD - discountedUSD
    memberWon     = false
    discountLabel = appliedCoupon.type === 'shipping'
      ? `🏷️ Coupon "${appliedCoupon.code}" (Free Shipping)`
      : `🏷️ Coupon "${appliedCoupon.code}" (${
          appliedCoupon.type === 'percent'
            ? `${appliedCoupon.discountPercent}% off`
            : `${formatPrice(appliedCoupon.discountUSD)} off`
        })`
  } else {
    // No coupon — normal highest-wins: sale vs member
    const saleDiscount   = activeSale ? activeSale.discount_percent : 0
    const memberDiscount = isMember ? 15 : 0
    effectiveDiscountPercent = Math.max(saleDiscount, memberDiscount)
    discountedUSD  = effectiveDiscountPercent > 0
      ? getDiscountedPrice(subtotalUSD, effectiveDiscountPercent)
      : subtotalUSD
    savingsUSD     = subtotalUSD - discountedUSD
    memberWon      = isMember && memberDiscount >= saleDiscount
    discountLabel  = effectiveDiscountPercent > 0
      ? memberWon
        ? `⭐ Member Discount (15%)`
        : `🔥 ${activeSale?.name ?? 'Sale'} (${saleDiscount}%)`
      : null
  }

  // ── Payment handler with server-side validation ───────────────────────────
  const handlePayment = async () => {
    setLoading(true)
    try {
      // May 15, 2026 REASON: Step 1 — call validate-discount server-side.
      //   Server re-computes the correct amount from scratch.
      //   Returns HMAC-signed token containing the validated amount.
      const validateRes = await fetch('/api/razorpay/validate-discount', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // May 15, 2026 REASON: Server uses this to verify membership.
          //   Without it server can't confirm membership and won't apply member discount.
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          items: items.map(item => ({
            id:       item.id,
            title:    item.title,
            price:    item.price,
            quantity: item.quantity,
            size:     item.size,
            image:    item.image,
          })),
          currency,
          country: form.country,
          // [May 19, 2026] REASON: Pass coupon code so server re-validates independently.
          //   Server never trusts client discount values — re-runs validateCoupon() from scratch.
          couponCode: appliedCoupon?.code ?? null,
        }),
      })

      if (!validateRes.ok) {
        const errData = await validateRes.json().catch(() => ({}))
        if (validateRes.status === 400 && errData.error?.includes('expired')) {
          toast.error('Your session timed out. Please refresh and try again.')
        } else {
          toast.error(errData.error ?? 'Could not validate order. Please try again.')
        }
        setLoading(false)
        return
      }

      const validateData = await validateRes.json()
      const { validationToken, savingsUSD: serverSavingsUSD, saleName: serverSaleName } = validateData

      // May 15, 2026 REASON: Step 2 — pass only the validationToken to create-order.
      //   create-order reads the amount from the token — client cannot influence it.
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validationToken }),
      })

      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}))
        toast.error(errData.error ?? 'Failed to create order. Please try again.')
        setLoading(false)
        return
      }

      const orderData = await orderRes.json()

      const options = {
        key:         process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount:      orderData.amount,
        currency:    orderData.currency,
        name:        'The Real Medico',
        description: `Order of ${items.length} item(s)${effectiveDiscountPercent > 0 ? ` — ${effectiveDiscountPercent}% discount applied` : ''}`,
        order_id:    orderData.order_id,
        prefill:     { name: form.name, email: form.email, contact: form.phone },
        notes: {
          address:          `${form.address}, ${form.city}, ${form.state} ${form.zip}, ${form.country}`,
          is_member:        String(orderData.isMember ?? isMember),
          discount_percent: String(effectiveDiscountPercent),
          sale_name:        orderData.saleName ?? activeSale?.name ?? null,
          savings_usd:      String(serverSavingsUSD ?? savingsUSD),
          // [May 19, 2026] REASON: Record coupon code in Razorpay notes for audit trail.
          coupon_code:      appliedCoupon?.code ?? null,
        },
        theme: { color: '#1A3A8F' },
        handler: async (response: any) => {
          const verifyRes = await fetch('/api/razorpay/verify', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ ...response, items, customer: form }),
          })
          const verifyData = await verifyRes.json()
          if (verifyData.verified) {
            // [May 19, 2026] REASON: Record coupon use AFTER payment is verified.
            //   Never apply before verify — a failed payment must never burn a coupon.
            if (appliedCoupon && accessToken) {
              await fetch('/api/coupon/apply', {
                method:  'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization:  `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                  couponId: appliedCoupon.couponId,
                  orderId:  response.razorpay_order_id,
                }),
              })
            }
            onPaymentSuccess()
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

  return (
    <>
      {/* Discount applied banner — coupon OR sale/member */}
      {(effectiveDiscountPercent > 0 || appliedCoupon?.type === 'shipping') && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <span className="text-2xl">
            {appliedCoupon ? '🏷️' : memberWon ? '⭐' : '🔥'}
          </span>
          <div>
            <p className="font-bold text-green-800">
              {appliedCoupon
                ? `Coupon "${appliedCoupon.code}" Applied!`
                : memberWon
                  ? 'Real Medico+ Discount Applied!'
                  : `${activeSale?.name} Sale Applied!`}
            </p>
            <p className="text-green-700 text-sm">
              {appliedCoupon?.type === 'shipping'
                ? 'Free shipping on this order'
                : <>
                    You're saving <strong>{formatPrice(savingsUSD)}</strong> on this order (
                    {effectiveDiscountPercent}%{' '}
                    {appliedCoupon ? 'coupon' : memberWon ? 'member' : 'sale'} discount)
                  </>
              }
            </p>
          </div>
        </div>
      )}

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {['Contact', 'Shipping', 'Payment'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 text-sm font-medium ${
              step === i + 1 ? 'text-primary' : step > i + 1 ? 'text-success' : 'text-text-slate'
            }`}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step === i + 1 ? 'bg-primary text-white' :
                step > i + 1  ? 'bg-success text-white' : 'bg-slate-200 text-slate-500'
              }`}>
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
            <>
              {showFOMO && !isMember && (
                <MembershipFOMOBanner
                  onDismiss={onDismissFOMO}
                  savings={formatPrice(subtotalUSD * 0.15)}
                />
              )}
              <div className="card p-6 space-y-4">
                <h2 className="text-xl font-bold">Contact Information</h2>
                <AddressPicker
                  addresses={savedAddresses}
                  selectedId={selectedAddressId}
                  onSelect={handleAddressSelect}
                  showContactFields
                />
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
            </>
          )}

          {/* Step 2 — Shipping */}
          {step === 2 && (
            <div className="card p-6 space-y-4">
              <h2 className="text-xl font-bold">Shipping Address</h2>
              <AddressPicker
                addresses={savedAddresses}
                selectedId={selectedAddressId}
                onSelect={handleAddressSelect}
                showContactFields={false}
              />
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
                  <option>Netherlands</option>
                  <option>Italy</option>
                  <option>Spain</option>
                  <option>UAE</option>
                  <option>Singapore</option>
                  <option>Malaysia</option>
                  <option>New Zealand</option>
                  <option>South Africa</option>
                  <option>Other</option>
                </select>
              </div>
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
              {showFOMO && !isMember && !appliedCoupon && (
                <MembershipFOMOBanner
                  onDismiss={onDismissFOMO}
                  savings={formatPrice(subtotalUSD * 0.15)}
                />
              )}
              <div className="card p-6 space-y-4">
                <h2 className="text-xl font-bold">Payment</h2>

                {/* [May 19, 2026] REASON: Coupon at top — visible without scrolling on mobile/iPad. */}
                <CouponInput
                  subtotalUSD={subtotalUSD}
                  accessToken={accessToken}
                  appliedCoupon={appliedCoupon}
                  onApply={setAppliedCoupon}
                  onRemove={() => setAppliedCoupon(null)}
                />

                <div className="bg-accent rounded-xl p-4 space-y-1 text-sm">
                  <p className="font-semibold text-text-dark">Delivering to:</p>
                  <p className="text-text-slate">{form.name} · {form.phone}</p>
                  <p className="text-text-slate">{form.address}, {form.city} {form.zip}, {form.country}</p>
                  <p className="text-text-slate">{form.email}</p>
                  <button onClick={() => setStep(1)} className="text-primary text-xs hover:underline mt-1">
                    Edit details
                  </button>
                </div>

                {/* Active discount confirmation */}
                {(effectiveDiscountPercent > 0 || appliedCoupon?.type === 'shipping') && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-sm">
                    <span>{appliedCoupon ? '🏷️' : memberWon ? '⭐' : '🔥'}</span>
                    <span className="text-green-800 font-medium">
                      {appliedCoupon?.type === 'shipping'
                        ? `Coupon "${appliedCoupon.code}" — free shipping applied`
                        : `${effectiveDiscountPercent}% ${
                            appliedCoupon ? 'coupon' : memberWon ? 'member' : 'sale'
                          } discount applied — saving ${formatPrice(savingsUSD)}`
                      }
                    </span>
                  </div>
                )}

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
                    {loading ? '⏳ Verifying...' : `Pay ${formatPrice(discountedUSD)} Securely`}
                  </button>
                </div>

                {/* May 15, 2026 REASON: Reassure user the brief "Verifying..." pause is normal */}
                {loading && (
                  <p className="text-center text-xs text-text-slate">
                    Verifying your discount server-side — this takes just a second…
                  </p>
                )}

                <p className="text-center text-xs text-text-slate">
                  🌍 International cards accepted · Paying in {CURRENCY_CONFIG[currency].label}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary sidebar */}
        <OrderSummary
          isMember={isMember}
          hasOrderedBefore={hasOrderedBefore}
          effectiveDiscountPercent={effectiveDiscountPercent}
          discountedUSD={discountedUSD}
          subtotalUSD={subtotalUSD}
          savingsUSD={savingsUSD}
          discountLabel={discountLabel}
          appliedCoupon={appliedCoupon}
        />
      </div>
    </>
  )
}

// ── Order Summary sidebar (co-located — only used by CheckoutForm) ────────────

function OrderSummary({
  isMember,
  hasOrderedBefore,
  effectiveDiscountPercent,
  discountedUSD,
  subtotalUSD,
  savingsUSD,
  discountLabel,
  appliedCoupon,
}: {
  isMember: boolean
  hasOrderedBefore: boolean
  effectiveDiscountPercent: number
  discountedUSD: number
  subtotalUSD: number
  savingsUSD: number
  discountLabel: string | null
  // [May 19, 2026] REASON: Needed to show free shipping coupon label in shipping row.
  appliedCoupon: CouponResult | null
}) {
  const { items } = useCartStore()
  const { formatPrice } = useCurrencyStore()

  return (
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
          <div className="flex justify-between text-sm font-medium" style={{ color: '#16a34a' }}>
            <span>{discountLabel}</span>
            <span>−{formatPrice(savingsUSD)}</span>
          </div>
        )}
        {/* [May 19, 2026] REASON: Show shipping coupon saving even when subtotal discount is 0 */}
        {appliedCoupon?.type === 'shipping' && (
          <div className="flex justify-between text-sm font-medium" style={{ color: '#16a34a' }}>
            <span>🏷️ Coupon "{appliedCoupon.code}"</span>
            <span>Free Shipping</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-text-slate">
          <span>Shipping</span>
          {/* [May 19, 2026] REASON: Both member and coupon free shipping show Free — no conflict. */}
          <span className={
            isMember || appliedCoupon?.freeShipping
              ? 'text-green-600 font-medium'
              : 'text-text-slate'
          }>
            {isMember
              ? '✅ Free (Member)'
              : appliedCoupon?.freeShipping
                ? '✅ Free (Coupon)'
                : 'Calculated at payment'}
          </span>
        </div>
        <div className="flex justify-between font-bold text-primary text-lg pt-1 border-t">
          <span>Total</span>
          <span>{formatPrice(discountedUSD)}</span>
        </div>
      </div>

      {!isMember && hasOrderedBefore && !appliedCoupon && (
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
  )
}
