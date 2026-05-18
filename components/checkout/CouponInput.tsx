'use client'
// ============================================================
// FILE: components/checkout/CouponInput.tsx
// PURPOSE: Coupon code input field + apply button + live feedback.
//   Used in Step 3 (Payment) of CheckoutForm.
// LAST CHANGED: May 19, 2026
// WHY IT EXISTS: Extracted as own component per modular architecture mandate.
//   CheckoutForm imports this — no coupon logic touches checkout/page.tsx.
// DEPENDENCIES: /api/coupon/validate, react-hot-toast, currencyStore
// ⚠️ DO NOT CHANGE: accessToken passed from parent — never call getSession() here.
//   Parent (checkout/page.tsx shell) owns auth state.
// ⚠️ DO NOT CHANGE: onApply receives the full validated result — CheckoutForm
//   uses it to show discount and pass couponId to apply route post-payment.
// ⚠️ DO NOT CHANGE: When a coupon is applied it DISABLES sale+member discounts.
//   CheckoutForm must zero out effectiveDiscountPercent when coupon is active.
//   This component signals that via onApply — CheckoutForm owns the final state.
// ============================================================

// --- CHANGE LOG ---
// [May 19, 2026] CREATED: New component for coupon code input
// REASON: Coupon system Tier 3 feature — component per architecture mandate.
// --- END CHANGE LOG ---

import { useState } from 'react'
import toast from 'react-hot-toast'
import { useCurrencyStore } from '@/store/currencyStore'

export interface CouponResult {
  couponId:        string
  code:            string
  type:            'percent' | 'fixed' | 'shipping'
  discountPercent: number
  discountUSD:     number
  freeShipping:    boolean
}

interface CouponInputProps {
  subtotalUSD:  number
  accessToken:  string | null
  appliedCoupon: CouponResult | null
  onApply:      (result: CouponResult) => void
  onRemove:     () => void
}

export default function CouponInput({
  subtotalUSD,
  accessToken,
  appliedCoupon,
  onApply,
  onRemove,
}: CouponInputProps) {
  const { formatPrice } = useCurrencyStore()
  const [code, setCode]       = useState('')
  const [loading, setLoading] = useState(false)

  const handleApply = async () => {
    if (!code.trim()) {
      toast.error('Please enter a coupon code.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/coupon/validate', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          // May 19, 2026 REASON: Server uses token to confirm membership for
          //   members_only / non_members_only coupons and one_per_user checks.
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ code, subtotalUSD }),
      })

      const data = await res.json()

      if (!data.valid) {
        toast.error(data.reason ?? 'Invalid coupon code.')
        setLoading(false)
        return
      }

      onApply({
        couponId:        data.couponId,
        code:            data.code,
        type:            data.type,
        discountPercent: data.discountPercent,
        discountUSD:     data.discountUSD,
        freeShipping:    data.freeShipping,
      })
      setCode('')
      toast.success(`Coupon "${data.code}" applied!`)
    } catch {
      toast.error('Could not apply coupon. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Applied state ─────────────────────────────────────────────────────────
  if (appliedCoupon) {
    const benefitText = (() => {
      if (appliedCoupon.type === 'percent') {
        return `${appliedCoupon.discountPercent}% off — saving ${formatPrice(appliedCoupon.discountUSD)}`
      }
      if (appliedCoupon.type === 'fixed') {
        return `${formatPrice(appliedCoupon.discountUSD)} off`
      }
      return 'Free shipping applied'
    })()

    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-green-600 text-lg">🏷️</span>
          <div>
            <p className="text-sm font-bold text-green-800">
              "{appliedCoupon.code}" applied
            </p>
            <p className="text-xs text-green-700">{benefitText}</p>
          </div>
        </div>
        <button
          onClick={onRemove}
          aria-label="Remove coupon"
          className="text-green-600 hover:text-red-500 transition-colors text-sm font-medium"
        >
          Remove
        </button>
      </div>
    )
  }

  // ── Input state ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-text-slate block">
        Coupon Code
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleApply()}
          placeholder="ENTER CODE"
          className="input-field flex-1 uppercase tracking-widest font-mono"
          disabled={loading}
          maxLength={32}
          aria-label="Coupon code"
        />
        <button
          onClick={handleApply}
          disabled={loading || !code.trim()}
          className="btn-primary px-5 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '⏳' : 'Apply'}
        </button>
      </div>
    </div>
  )
}
