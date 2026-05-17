'use client'
// ============================================================
// FILE: components/account/MembershipTab.tsx
// PURPOSE: Real Medico+ membership tab — join UI, active member UI, post-cancel state
// LAST CHANGED: May 17, 2026
// WHY IT EXISTS: Extracted from app/account/page.tsx as part of modular refactor.
//   Logic is identical — only moved to own file.
// DEPENDENCIES: CancelFlow component, react-hot-toast, NEXT_PUBLIC_RAZORPAY_KEY_ID
// ⚠️ DO NOT CHANGE: handleJoinMembership — calls create-subscription, then verify-subscription.
//   Razorpay options differ for subscription mode vs order fallback mode.
//   Both modes flow through the same handler — do not split them.
// ⚠️ DO NOT CHANGE: handleConfirmCancel — requires accessToken (Bearer header).
//   cancel-membership API verifies user identity via this token.
// ⚠️ DO NOT CHANGE: membershipChecked ref is owned by parent (account/page.tsx).
//   After a successful join, parent sets membershipChecked.current = user.id
//   so the membership state isn't re-fetched on next re-render.
// ============================================================

import { useState } from 'react'
import toast from 'react-hot-toast'
import CancelFlow from './CancelFlow'

// May 17, 2026 REASON: MEMBER_BENEFITS shared between join screen and cancel flow.
// CancelFlow has its own local copy (avoids circular import).
export const MEMBER_BENEFITS = [
  { icon: '🛍️', title: 'Early Access',       desc: 'New products 7 days before everyone else' },
  { icon: '💰', title: '15% Off Everything', desc: 'Every order, every product, always' },
  { icon: '📦', title: 'Free Shipping',       desc: 'Worldwide, no minimum order value' },
  { icon: '🔔', title: 'Drop Alerts',         desc: 'First to know about limited editions' },
  { icon: '⚡', title: 'Priority Support',    desc: 'Same-day responses, skip the queue' },
  { icon: '🏥', title: 'Community Access',    desc: 'Exclusive healthcare professional community' },
]

interface MembershipTabProps {
  user: any
  isMember: boolean
  memberExpiresAt: string | null
  memberSince: string | null
  accessToken: string | null
  onJoinSuccess: (expiresAt: string | null) => void
  onCancelSuccess: (accessUntil: string | null) => void
}

export default function MembershipTab({
  user,
  isMember,
  memberExpiresAt,
  memberSince,
  accessToken,
  onJoinSuccess,
  onCancelSuccess,
}: MembershipTabProps) {
  const [showCancelFlow, setShowCancelFlow] = useState(false)
  const [memberCancelled, setMemberCancelled] = useState(false)
  const [cancelAccessUntil, setCancelAccessUntil] = useState<string | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)

  // ── Join handler ──────────────────────────────────────────────────────────
  const handleJoinMembership = async () => {
    if (!user) { toast.error('Please sign in first'); return }
    setPaymentLoading(true)

    try {
      // May 15, 2026 REASON: Step 1 — create subscription or fallback order
      const res = await fetch('/api/razorpay/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.user_metadata?.name || '',
          userId: user.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create payment')

      // May 15, 2026 REASON: Build Razorpay options based on mode returned by server.
      // subscription mode = recurring billing. order mode = one-time fallback.
      const rzpOptions: any = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: data.currency,
        name: 'The Real Medico',
        description: 'Real Medico+ Monthly Membership',
        prefill: { email: user.email, name: user.user_metadata?.name || '' },
        theme: { color: '#1A3A8F' },
        modal: {
          ondismiss: () => {
            toast('Payment cancelled', { icon: 'ℹ️' })
            setPaymentLoading(false)
          },
        },
        handler: async (response: any) => {
          // May 15, 2026 REASON: Step 2 — verify payment server-side
          const verifyRes = await fetch('/api/razorpay/verify-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...response,
              user_id: user.id,
              user_email: user.email,
              mode: data.mode,
            }),
          })
          const verifyData = await verifyRes.json()
          if (verifyData.verified) {
            setMemberCancelled(false)
            setShowCancelFlow(false)
            onJoinSuccess(verifyData.expires_at || null)
            toast.success('🎉 Welcome to Real Medico+! Your benefits are now active.')
          } else {
            toast.error('Payment verification failed. Please contact support.')
          }
          setPaymentLoading(false)
        },
      }

      // May 15, 2026 REASON: Attach subscription_id or order_id based on mode
      if (data.mode === 'subscription') {
        rzpOptions.subscription_id = data.subscription_id
      } else {
        rzpOptions.order_id = data.order_id
      }

      const rzp = new (window as any).Razorpay(rzpOptions)
      rzp.open()
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong. Please try again.')
      setPaymentLoading(false)
    }
  }

  // ── Cancel handler ────────────────────────────────────────────────────────
  const handleConfirmCancel = async (reason: string) => {
    if (!accessToken) { toast.error('Session expired. Please refresh and try again.'); return }

    const res = await fetch('/api/razorpay/cancel-membership', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ cancel_reason: reason }),
    })
    const data = await res.json()

    if (data.cancelled) {
      setMemberCancelled(true)
      setShowCancelFlow(false)
      setCancelAccessUntil(data.access_until)
      onCancelSuccess(data.access_until)
      toast.success('Membership cancelled. You keep access until your billing period ends.')
    } else {
      toast.error(data.error || 'Cancellation failed. Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Real Medico+ Membership</h2>

      {/* ── Post-cancel state ── */}
      {memberCancelled && (
        <div className="card p-6 bg-slate-50 border border-slate-200 text-center">
          <div className="text-4xl mb-3">👋</div>
          <h3 className="font-bold text-text-dark mb-2">Your membership has been cancelled</h3>
          {cancelAccessUntil && (
            <p className="text-text-slate text-sm mb-4">
              You keep all benefits until{' '}
              <strong>
                {new Date(cancelAccessUntil).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </strong>
            </p>
          )}
          <button onClick={() => setMemberCancelled(false)} className="btn-primary">
            Rejoin Real Medico+ →
          </button>
        </div>
      )}

      {/* ── Active member state ── */}
      {isMember && !memberCancelled && (
        <div className="space-y-4">
          {showCancelFlow ? (
            <CancelFlow
              onKeep={() => setShowCancelFlow(false)}
              onConfirmCancel={handleConfirmCancel}
              memberSince={memberSince}
            />
          ) : (
            <div className="card p-6 border-2 border-primary">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">⭐</span>
                <div>
                  <h3 className="font-bold text-primary text-lg">You're a Real Medico+ Member!</h3>
                  <p className="text-text-slate text-sm">Your exclusive benefits are active</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {memberSince && (
                  <div className="bg-accent rounded-xl p-3 text-center">
                    <p className="text-xs text-text-slate mb-1">Member since</p>
                    <p className="font-bold text-sm text-text-dark">
                      {new Date(memberSince).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )}
                {memberExpiresAt && (
                  <div className="bg-accent rounded-xl p-3 text-center">
                    <p className="text-xs text-text-slate mb-1">Next billing</p>
                    <p className="font-bold text-sm text-text-dark">
                      {new Date(memberExpiresAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-5">
                {MEMBER_BENEFITS.map((b) => (
                  <div key={b.title} className="flex items-center gap-3 text-sm">
                    <span className="text-base">{b.icon}</span>
                    <span className="font-medium text-text-dark">{b.title}</span>
                    <span className="ml-auto text-green-500 font-bold text-xs">✓ Active</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowCancelFlow(true)}
                className="w-full text-center text-xs text-text-slate hover:text-red-500 transition-colors py-2"
              >
                Cancel membership
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Non-member state ── */}
      {!isMember && !memberCancelled && (
        <>
          <div className="bg-gradient-to-br from-primary to-primary-dark text-white rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-4xl">👨‍⚕️</span>
              <div>
                <h3 className="text-2xl font-heading font-black">Real Medico+</h3>
                <p className="text-blue-200">Premium membership for healthcare professionals</p>
              </div>
            </div>
            <div className="text-4xl font-black mb-1">
              ₹415<span className="text-xl font-normal text-blue-200">/month</span>
            </div>
            <p className="text-blue-200 text-sm mb-6">~$5 · Auto-renews monthly · Cancel anytime</p>
            <button
              onClick={handleJoinMembership}
              disabled={paymentLoading}
              className="bg-white text-primary font-bold px-8 py-3 rounded-xl hover:bg-accent transition-all w-full text-center block disabled:opacity-70"
            >
              {paymentLoading ? 'Setting up payment...' : 'Join Real Medico+ →'}
            </button>
            <p className="text-blue-200 text-xs text-center mt-3">
              🔒 Exclusive membership — not open to general public
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MEMBER_BENEFITS.map((benefit) => (
              <div key={benefit.title} className="card p-5 flex gap-4">
                <span className="text-3xl flex-shrink-0">{benefit.icon}</span>
                <div>
                  <h4 className="font-bold text-text-dark mb-1">{benefit.title}</h4>
                  <p className="text-text-slate text-sm leading-relaxed">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
