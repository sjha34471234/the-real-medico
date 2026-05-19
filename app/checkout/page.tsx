'use client'
// ============================================================
// FILE: app/checkout/page.tsx
// PURPOSE: Shell — auth gate, empty cart guard, Razorpay script, saved address
//   fetch, membership check. Delegates all UI to CheckoutForm.
// LAST CHANGED: May 19, 2026
// WHY IT EXISTS: Checkout page. Refactored from ~600-line monolith to shell per
//   modular architecture mandate (May 16, 2026).
// DEPENDENCIES: components/checkout/CheckoutForm, cartStore, Supabase anon client
// ⚠️ DO NOT CHANGE: onAuthStateChange pattern — never getSession on mount (rule #10)
// ⚠️ DO NOT CHANGE: membership uses .eq('active', true) NOT .eq('status','active')
//   memberships table has boolean 'active' column, not a 'status' text column
// ⚠️ DO NOT CHANGE: maybeSingle() not single() — single() errors on no rows
// ⚠️ DO NOT CHANGE: Razorpay <Script> loaded here with strategy="afterInteractive".
//   layout.tsx header detection can fail on Vercel → script never loads → payment fails.
//   Loading here guarantees it loads exactly when the checkout page mounts.
// ⚠️ DO NOT CHANGE: accessToken is BOTH a ref and state.
//   Ref — for handlePayment in CheckoutForm (reads at call time, always fresh).
//   State — so CheckoutForm re-renders when token arrives, giving CouponInput
//   the token it needs for membership validation. Ref alone does not trigger re-render.
// ============================================================

// --- CHANGE LOG ---
// [May 17, 2026] REFACTORED: Split ~600-line monolith into shell + components/checkout/
// REASON: Modular architecture mandate — one file, one responsibility.
// [May 19, 2026] FIXED: accessToken passed as ref value (always null on first render).
// REASON: CouponInput calls /api/coupon/validate with the token to verify membership.
//   Refs don't trigger re-renders — CheckoutForm received null even after auth resolved.
//   Fix: mirror the token into accessTokenState so CheckoutForm re-renders with the real token.
// --- END CHANGE LOG ---

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import Script from 'next/script'
import useCartStore from '@/store/cartStore'
import toast from 'react-hot-toast'
import CheckoutForm from '@/components/checkout/CheckoutForm'

// May 14, 2026 REASON: Single instance outside component — not recreated on every render
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CheckoutPage() {
  const { items, clearCart } = useCartStore()
  const [isMember, setIsMember]                 = useState(false)
  const [hasOrderedBefore, setHasOrderedBefore] = useState(false)
  const [showFOMO, setShowFOMO]                 = useState(false)
  const [currentUser, setCurrentUser]           = useState<any>(null)
  const [savedAddresses, setSavedAddresses]     = useState<any[]>([])

  // May 19, 2026 FIX: accessToken kept as BOTH ref and state.
  //   accessTokenRef — read by handlePayment at call time (always current, no stale closure).
  //   accessTokenState — passed as prop so CheckoutForm re-renders when token arrives.
  //   Without the state mirror, CouponInput always receives null and membership check fails.
  const accessTokenRef = useRef<string | null>(null)
  const [accessTokenState, setAccessTokenState] = useState<string | null>(null)

  useEffect(() => {
    // May 14, 2026 FIX: onAuthStateChange — never getSession on mount (rule #10)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null
        setCurrentUser(user)

        // May 15, 2026 REASON: Store access token for validate-discount Authorization header.
        // May 19, 2026 FIX: Also mirror into state so CheckoutForm re-renders with real token.
        accessTokenRef.current = session?.access_token ?? null
        setAccessTokenState(session?.access_token ?? null)

        if (!user) {
          setIsMember(false)
          setSavedAddresses([])
          return
        }

        // May 14, 2026 FIX: query by user_id not email; boolean 'active' not status text
        const { data: membership, error } = await supabase
          .from('memberships')
          .select('id')
          .eq('user_id', user.id)
          .eq('active', true)
          .maybeSingle()

        if (!error && membership) {
          setIsMember(true)
        } else {
          // May 14, 2026 REASON: Show FOMO banner to returning non-members
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
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  // May 14, 2026 REASON: Separate useEffect for address fetch — runs immediately
  // when currentUser state updates, not buried inside onAuthStateChange async chain.
  useEffect(() => {
    if (!currentUser) {
      setSavedAddresses([])
      return
    }
    const fetchAddresses = async () => {
      const { data: addrs } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('is_default', { ascending: false })
      if (addrs && addrs.length > 0) setSavedAddresses(addrs)
    }
    fetchAddresses()
  }, [currentUser])

  const handlePaymentSuccess = () => {
    clearCart()
    toast.success('Order placed successfully!')
    window.location.href = '/order-success'
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

      <CheckoutForm
        isMember={isMember}
        hasOrderedBefore={hasOrderedBefore}
        showFOMO={showFOMO}
        onDismissFOMO={() => setShowFOMO(false)}
        // May 19, 2026 FIX: Pass accessTokenState (not accessTokenRef.current) so
        //   CheckoutForm re-renders when the token arrives after auth resolves.
        //   CouponInput uses this to send the Bearer header for membership validation.
        accessToken={accessTokenState}
        savedAddresses={savedAddresses}
        currentUser={currentUser}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* May 15, 2026 REASON: Razorpay loaded here not layout.tsx.
          layout.tsx uses header-based isCheckout detection which can fail on Vercel
          if x-next-url header is empty → script never loads → window.Razorpay undefined → payment fails.
          Loading here guarantees it loads exactly when checkout page mounts. */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />
    </div>
  )
}
