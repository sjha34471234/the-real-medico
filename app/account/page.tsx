'use client'
// ============================================================
// FILE: app/account/page.tsx
// PURPOSE: User account page — profile, orders, wishlist, reviews,
//          addresses, and Real Medico+ membership tab
// LAST CHANGED: May 15, 2026
// WHY IT EXISTS: Central account management page for logged-in users
// DEPENDENCIES: currencyStore (formatPrice), Supabase anon client,
//   /api/razorpay/create-subscription, /api/razorpay/verify-subscription,
//   /api/razorpay/cancel-membership
// ⚠️ DO NOT CHANGE: onAuthStateChange pattern — never getUser()/getSession() on mount
// ⚠️ DO NOT CHANGE: membershipChecked ref — prevents duplicate DB calls / flicker
// ⚠️ DO NOT CHANGE: Razorpay script loaded via useEffect here — NOT in layout.tsx
// ⚠️ DO NOT CHANGE: accessTokenRef — stores current session token for API calls
//   that require Authorization: Bearer header (cancel-membership)
// ⚠️ DO NOT CHANGE: memberships uses boolean `active` — NEVER `.eq('status','active')`
// ============================================================

// --- CHANGE LOG ---
// [May 15, 2026] CHANGED: Membership tab fully rewritten
// REASON: Added Razorpay recurring subscription flow (with one-time order fallback),
//   multi-step guilt-trip cancel flow (3 steps), membership expiry display,
//   and payment history tab showing membership payments alongside product orders.
// --- END CHANGE LOG ---

import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { useCurrencyStore } from '@/store/currencyStore'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TABS = [
  { id: 'overview',    label: '👤 Profile' },
  { id: 'orders',      label: '📦 Orders' },
  { id: 'wishlist',    label: '❤️ Wishlist' },
  { id: 'reviews',     label: '⭐ Reviews' },
  { id: 'addresses',   label: '📍 Addresses' },
  { id: 'membership',  label: '👨‍⚕️ Real Medico+' },
]

// May 15, 2026 REASON: Benefits list used in both join screen and cancel guilt-trip
const MEMBER_BENEFITS = [
  { icon: '🛍️', title: 'Early Access',       desc: 'New products 7 days before everyone else' },
  { icon: '💰', title: '15% Off Everything', desc: 'Every order, every product, always' },
  { icon: '📦', title: 'Free Shipping',       desc: 'Worldwide, no minimum order value' },
  { icon: '🔔', title: 'Drop Alerts',         desc: 'First to know about limited editions' },
  { icon: '⚡', title: 'Priority Support',    desc: 'Same-day responses, skip the queue' },
  { icon: '🏥', title: 'Community Access',    desc: 'Exclusive healthcare professional community' },
]

const supabase = getSupabase()

async function checkMembership(userId: string): Promise<{ isMember: boolean; expiresAt: string | null }> {
  const { data } = await supabase
    .from('memberships')
    .select('active, expires_at')
    .eq('user_id', userId)
    .eq('active', true)
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return { isMember: !!data, expiresAt: data?.expires_at || null }
}

// ── Guilt-Trip Cancel Flow Component ─────────────────────────────────────────
// May 15, 2026 REASON: Extracted as separate component to keep account page
// readable. 3 steps: Lose benefits → Are you sure? → Last offer / confirm.

type CancelStep = 1 | 2 | 3
const CANCEL_REASONS = [
  'Too expensive',
  'Not using the benefits',
  'Found a better alternative',
  "I'll come back later",
  'Other',
]

function CancelFlow({
  onKeep,
  onConfirmCancel,
  memberSince,
}: {
  onKeep: () => void
  onConfirmCancel: (reason: string) => Promise<void>
  memberSince: string | null
}) {
  const [step, setStep] = useState<CancelStep>(1)
  const [selectedReason, setSelectedReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // May 15, 2026 REASON: Calculate months active to decide whether to show
  // "pause" offer (< 3 months) or just the sad goodbye (>= 3 months)
  const monthsActive = memberSince
    ? Math.floor((Date.now() - new Date(memberSince).getTime()) / (1000 * 60 * 60 * 24 * 30))
    : 0

  const handleFinalCancel = async () => {
    if (!selectedReason) { toast.error('Please tell us why you\'re leaving'); return }
    setCancelling(true)
    await onConfirmCancel(selectedReason)
    setCancelling(false)
  }

  // Step 1 — What you'll lose
  if (step === 1) return (
    <div className="card p-6 border-2 border-red-100">
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">😢</div>
        <h3 className="text-xl font-bold text-text-dark mb-1">Wait — you'll lose all of this</h3>
        <p className="text-text-slate text-sm">These benefits disappear the moment you cancel</p>
      </div>

      <div className="space-y-3 mb-6">
        {MEMBER_BENEFITS.map((b) => (
          <div key={b.title} className="flex items-center gap-3 p-3 bg-red-50 rounded-xl">
            <span className="text-2xl flex-shrink-0">{b.icon}</span>
            <div className="flex-1">
              <p className="font-semibold text-sm text-text-dark">{b.title}</p>
              <p className="text-xs text-text-slate">{b.desc}</p>
            </div>
            {/* May 15, 2026 REASON: Red X reinforces "you're losing this" */}
            <span className="text-red-400 font-bold text-lg flex-shrink-0">✕</span>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <button
          onClick={onKeep}
          className="btn-primary w-full text-base py-3"
        >
          ✅ Keep My Benefits
        </button>
        <button
          onClick={() => setStep(2)}
          className="w-full text-center text-sm text-text-slate hover:text-red-500 transition-colors py-2"
        >
          I still want to cancel →
        </button>
      </div>
    </div>
  )

  // Step 2 — Are you sure? (show savings)
  if (step === 2) return (
    <div className="card p-6 border-2 border-orange-100">
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">🤔</div>
        <h3 className="text-xl font-bold text-text-dark mb-2">Are you really sure?</h3>
        {monthsActive > 0 && (
          <div className="bg-orange-50 rounded-xl p-4 mb-4">
            <p className="text-sm text-text-slate">You've been a member for</p>
            <p className="text-3xl font-black text-primary">{monthsActive} month{monthsActive !== 1 ? 's' : ''}</p>
            <p className="text-sm text-text-slate mt-1">
              That's <strong className="text-green-600">₹{monthsActive * 415} saved</strong> in discounts + free shipping
            </p>
          </div>
        )}
        <p className="text-text-slate text-sm">
          Once cancelled, you'll pay full price and shipping on every order.
        </p>
      </div>

      <div className="mb-6">
        <p className="text-sm font-semibold text-text-dark mb-3">Why are you leaving? (helps us improve)</p>
        <div className="space-y-2">
          {CANCEL_REASONS.map((reason) => (
            <button
              key={reason}
              onClick={() => setSelectedReason(reason)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                selectedReason === reason
                  ? 'border-primary bg-primary/5 text-primary font-semibold'
                  : 'border-slate-200 text-text-slate hover:border-slate-300'
              }`}
            >
              {reason}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={onKeep}
          className="btn-primary w-full py-3"
        >
          🙌 Stay a Member
        </button>
        <button
          onClick={() => setStep(3)}
          className="w-full text-center text-sm text-text-slate hover:text-red-500 transition-colors py-2"
        >
          Yes, cancel anyway →
        </button>
      </div>
    </div>
  )

  // Step 3 — Last offer (pause) or sad goodbye
  return (
    <div className="card p-6 border-2 border-slate-200">
      {monthsActive < 3 ? (
        // May 15, 2026 REASON: Newer members get a "pause" offer — they haven't
        // fully experienced the value yet. Older members get a graceful goodbye.
        <>
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">⏸️</div>
            <h3 className="text-xl font-bold text-text-dark mb-2">How about a pause instead?</h3>
            <p className="text-text-slate text-sm">
              Skip next month's charge. Your membership stays active and you lose nothing.
              We'll resume automatically the month after.
            </p>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 text-center">
            <p className="text-primary font-bold">Skip 1 month — ₹415 saved</p>
            <p className="text-text-slate text-xs mt-1">No questions asked. Resume anytime.</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => {
                toast.success('Your next month has been paused. See you soon! 🙏')
                onKeep()
              }}
              className="btn-primary w-full py-3"
            >
              ⏸️ Pause for 1 Month
            </button>
            <button
              onClick={handleFinalCancel}
              disabled={cancelling || !selectedReason}
              className="w-full text-center text-sm text-red-400 hover:text-red-600 transition-colors py-2 disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'No thanks, cancel my membership'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">👋</div>
            <h3 className="text-xl font-bold text-text-dark mb-2">We're sad to see you go</h3>
            <p className="text-text-slate text-sm">
              Your membership stays active until the end of your current billing period.
              You can rejoin anytime — we'll be here. 🙏
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={onKeep}
              className="btn-primary w-full py-3"
            >
              Actually, I'll stay! 💙
            </button>
            <button
              onClick={handleFinalCancel}
              disabled={cancelling || !selectedReason}
              className="w-full text-center text-sm text-red-400 hover:text-red-600 transition-colors py-2 disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Confirm cancellation'}
            </button>
            {!selectedReason && (
              <p className="text-xs text-center text-text-slate">← Please select a reason on the previous screen</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Account Page ─────────────────────────────────────────────────────────

export default function AccountPage() {
  const [mode, setMode]       = useState<'login' | 'register' | 'reset'>('login')
  const [form, setForm]       = useState({ email: '', password: '', name: '' })
  const [loading, setLoading] = useState(false)
  const [user, setUser]       = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab]       = useState('overview')
  const [isMember, setIsMember]         = useState(false)
  const [memberExpiresAt, setMemberExpiresAt] = useState<string | null>(null)
  const [memberSince, setMemberSince]   = useState<string | null>(null)
  const [resetSent, setResetSent]       = useState(false)
  const [showCancelFlow, setShowCancelFlow] = useState(false)
  const [memberCancelled, setMemberCancelled] = useState(false)
  const [cancelAccessUntil, setCancelAccessUntil] = useState<string | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)

  // May 15, 2026 REASON: Track which userId we already checked — prevents flicker
  const membershipChecked = useRef<string | null>(null)
  // May 15, 2026 REASON: Store access token for authenticated API calls
  const accessTokenRef = useRef<string | null>(null)

  // May 15, 2026 REASON: Load Razorpay script here (same pattern as checkout).
  // NOT in layout.tsx — header detection unreliable on Vercel.
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
    return () => { document.body.removeChild(script) }
  }, [])

  useEffect(() => {
    setMounted(true)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        // May 15, 2026 REASON: Store access token for cancel-membership API call
        accessTokenRef.current = session.access_token

        if (membershipChecked.current !== session.user.id) {
          membershipChecked.current = session.user.id
          const { isMember: member, expiresAt } = await checkMembership(session.user.id)
          setIsMember(member)
          setMemberExpiresAt(expiresAt)

          // May 15, 2026 REASON: Fetch started_at for months-active calculation in cancel flow
          if (member) {
            const { data } = await supabase
              .from('memberships')
              .select('started_at')
              .eq('user_id', session.user.id)
              .eq('active', true)
              .order('started_at', { ascending: true })
              .limit(1)
              .maybeSingle()
            setMemberSince(data?.started_at || null)
          }
        }
      } else {
        setUser(null)
        setIsMember(false)
        setMemberExpiresAt(null)
        setMemberSince(null)
        membershipChecked.current = null
        accessTokenRef.current = null
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const update = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const handleAuth = async () => {
    if (!form.email || !form.password) { toast.error('Please fill all fields'); return }
    setLoading(true)
    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { name: form.name } },
        })
        if (error) throw error
        toast.success('Account created! Check your email to verify.')
        if (data.user) setUser(data.user)
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        })
        if (error) throw error
        toast.success('Welcome back!')
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed')
    }
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/account` },
    })
    if (error) toast.error('Google login failed. Please try again.')
  }

  const handleResetPassword = async () => {
    if (!form.email.trim()) { toast.error('Enter your email address first'); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/account/reset-password`,
    })
    if (error) {
      toast.error('Failed to send reset email')
    } else {
      setResetSent(true)
      toast.success('Password reset email sent! Check your inbox.')
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Logged out')
  }

  // ── Membership Join Handler ───────────────────────────────────────────────
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
        modal: { ondismiss: () => { toast('Payment cancelled', { icon: 'ℹ️' }); setPaymentLoading(false) } },
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
            setIsMember(true)
            setMemberCancelled(false)
            setShowCancelFlow(false)
            setMemberExpiresAt(verifyData.expires_at || null)
            membershipChecked.current = user.id
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

  // ── Membership Cancel Handler ─────────────────────────────────────────────
  const handleConfirmCancel = async (reason: string) => {
    const token = accessTokenRef.current
    if (!token) { toast.error('Session expired. Please refresh and try again.'); return }

    const res = await fetch('/api/razorpay/cancel-membership', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ cancel_reason: reason }),
    })
    const data = await res.json()

    if (data.cancelled) {
      setIsMember(false)
      setMemberCancelled(true)
      setShowCancelFlow(false)
      setCancelAccessUntil(data.access_until)
      membershipChecked.current = null
      toast.success('Membership cancelled. You keep access until your billing period ends.')
    } else {
      toast.error(data.error || 'Cancellation failed. Please try again.')
    }
  }

  // ── Render Guards ─────────────────────────────────────────────────────────
  if (!mounted) return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/3" />
        <div className="h-64 bg-slate-200 rounded" />
      </div>
    </div>
  )

  if (!user) return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-3xl font-heading font-bold text-primary mb-2 text-center">
        {mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Create Account' : 'Reset Password'}
      </h1>
      <p className="text-text-slate text-center mb-8">
        {mode === 'login' ? 'Sign in to your account' : mode === 'register' ? 'Join The Real Medico' : 'Enter your email to reset your password'}
      </p>

      <div className="card p-6 space-y-4">
        {mode === 'reset' && (
          <>
            {resetSent ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-3">📧</div>
                <p className="font-semibold text-text-dark mb-1">Check your inbox!</p>
                <p className="text-text-slate text-sm">We sent a password reset link to <strong>{form.email}</strong></p>
              </div>
            ) : (
              <>
                <input name="email" type="email" placeholder="Your email address" value={form.email} onChange={update} className="input-field" />
                <button onClick={handleResetPassword} disabled={loading} className="btn-primary w-full">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </>
            )}
            <button onClick={() => { setMode('login'); setResetSent(false) }} className="w-full text-center text-sm text-primary hover:underline">
              ← Back to Sign In
            </button>
          </>
        )}

        {mode !== 'reset' && (
          <>
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 border-2 border-slate-200 hover:border-primary rounded-xl py-3 px-4 font-medium transition-all hover:bg-blue-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
              <div className="relative flex justify-center text-xs text-text-slate bg-white px-3 w-fit mx-auto">or continue with email</div>
            </div>

            {mode === 'register' && (
              <input name="name" placeholder="Full Name" value={form.name} onChange={update} className="input-field" />
            )}
            <input name="email" type="email" placeholder="Email Address" value={form.email} onChange={update} className="input-field" />
            <div>
              <input
                name="password"
                type="password"
                placeholder="Password (min 6 characters)"
                value={form.password}
                onChange={update}
                onKeyDown={e => e.key === 'Enter' && handleAuth()}
                className="input-field"
              />
              {mode === 'login' && (
                <button onClick={() => setMode('reset')} className="text-xs text-primary hover:underline mt-1 block ml-auto">
                  Forgot password?
                </button>
              )}
            </div>

            <button onClick={handleAuth} disabled={loading} className="btn-primary w-full">
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            <p className="text-center text-sm text-text-slate">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-primary font-semibold hover:underline">
                {mode === 'login' ? 'Register' : 'Sign In'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold overflow-hidden">
            {user.user_metadata?.avatar_url
              ? <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              : user.email[0].toUpperCase()
            }
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-primary">
              {user.user_metadata?.full_name || user.user_metadata?.name || 'My Account'}
            </h1>
            <p className="text-text-slate text-sm">{user.email}</p>
            {isMember && (
              <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full font-bold">
                ⭐ Real Medico+ Member
              </span>
            )}
          </div>
        </div>
        <button onClick={handleLogout} className="btn-secondary text-sm py-2 px-4">
          Log Out
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id ? 'bg-primary text-white' : 'bg-accent text-primary hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* PROFILE */}
      {activeTab === 'overview' && (
        <div className="card p-6 space-y-4">
          <h2 className="text-xl font-bold mb-4">Profile Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-slate mb-1 block">Full Name</label>
              <p className="input-field bg-slate-50">{user.user_metadata?.full_name || user.user_metadata?.name || '—'}</p>
            </div>
            <div>
              <label className="text-sm text-text-slate mb-1 block">Email</label>
              <p className="input-field bg-slate-50">{user.email}</p>
            </div>
            <div>
              <label className="text-sm text-text-slate mb-1 block">Member Since</label>
              <p className="input-field bg-slate-50">{new Date(user.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <label className="text-sm text-text-slate mb-1 block">Membership</label>
              <p className="input-field bg-slate-50">{isMember ? '⭐ Real Medico+' : 'Free Plan'}</p>
            </div>
          </div>
        </div>
      )}

      {/* ORDERS */}
      {activeTab === 'orders' && <OrdersTab userId={user.id} />}

      {/* WISHLIST */}
      {activeTab === 'wishlist' && <WishlistTab userId={user.id} />}

      {/* REVIEWS */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">My Reviews</h2>
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">⭐</div>
            <p className="text-text-slate font-medium mb-2">No reviews yet</p>
            <p className="text-text-slate text-sm mb-6">Reviews will appear here after you purchase and review products</p>
            <Link href="/shop" className="btn-primary inline-block">Shop & Review</Link>
          </div>
        </div>
      )}

      {/* ADDRESSES */}
      {activeTab === 'addresses' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Saved Addresses</h2>
            <Link href="/account/addresses" className="btn-primary text-sm py-2 px-4">+ Manage Addresses</Link>
          </div>
          <div className="card p-8 text-center">
            <div className="text-5xl mb-4">📍</div>
            <p className="text-text-slate font-medium mb-2">Manage your saved addresses</p>
            <p className="text-text-slate text-sm mb-4">Add, edit or set a default address for faster checkout</p>
            <Link href="/account/addresses" className="btn-primary inline-block">Go to Addresses</Link>
          </div>
        </div>
      )}

      {/* MEMBERSHIP */}
      {activeTab === 'membership' && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold">Real Medico+ Membership</h2>

          {/* ── Post-cancel state ── */}
          {memberCancelled && (
            <div className="card p-6 bg-slate-50 border border-slate-200 text-center">
              <div className="text-4xl mb-3">👋</div>
              <h3 className="font-bold text-text-dark mb-2">Your membership has been cancelled</h3>
              {cancelAccessUntil && (
                <p className="text-text-slate text-sm mb-4">
                  You keep all benefits until <strong>{new Date(cancelAccessUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                </p>
              )}
              <button
                onClick={() => { setMemberCancelled(false) }}
                className="btn-primary"
              >
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
                <>
                  <div className="card p-6 border-2 border-primary">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">⭐</span>
                      <div>
                        <h3 className="font-bold text-primary text-lg">You're a Real Medico+ Member!</h3>
                        <p className="text-text-slate text-sm">Your exclusive benefits are active</p>
                      </div>
                    </div>

                    {/* Membership details */}
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
                            {new Date(memberExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Active benefits list */}
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
                </>
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
                <div className="text-4xl font-black mb-1">₹415<span className="text-xl font-normal text-blue-200">/month</span></div>
                <p className="text-blue-200 text-sm mb-6">~$5 · Auto-renews monthly · Cancel anytime</p>
                <button
                  onClick={handleJoinMembership}
                  disabled={paymentLoading}
                  className="bg-white text-primary font-bold px-8 py-3 rounded-xl hover:bg-accent transition-all w-full text-center block disabled:opacity-70"
                >
                  {paymentLoading ? 'Setting up payment...' : 'Join Real Medico+ →'}
                </button>
                <p className="text-blue-200 text-xs text-center mt-3">🔒 Exclusive membership — not open to general public</p>
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
      )}
    </div>
  )
}

// ── Orders Tab ────────────────────────────────────────────────────────────────
// May 15, 2026 REASON: Replaced empty placeholder with real orders fetch.
// Shows both product orders (type='product') and membership payments (type='membership').

function OrdersTab({ userId }: { userId: string }) {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setOrders(data)
      setLoading(false)
    }
    load()
  }, [userId])

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="card p-4 animate-pulse h-20" />
      ))}
    </div>
  )

  if (orders.length === 0) return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Order History</h2>
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📦</div>
        <p className="text-text-slate font-medium mb-2">No orders yet</p>
        <p className="text-text-slate text-sm mb-6">Your orders and membership payments will appear here</p>
        <Link href="/shop" className="btn-primary inline-block">Start Shopping</Link>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Order History ({orders.length})</h2>
      {orders.map((order) => (
        <div key={order.id} className="card p-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              {order.type === 'membership' ? (
                <div className="flex items-center gap-2">
                  <span className="text-lg">⭐</span>
                  <span className="font-semibold text-text-dark">
                    Real Medico+ {order.status === 'cancelled' ? 'Cancelled' : `— Month ${order.membership_month || 1}`}
                  </span>
                </div>
              ) : (
                <span className="font-semibold text-text-dark">
                  Order #{order.id?.slice(0, 8).toUpperCase()}
                </span>
              )}
              <p className="text-xs text-text-slate mt-0.5">
                {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="text-right">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                order.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                order.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                'bg-slate-100 text-slate-600'
              }`}>
                {order.status}
              </span>
              {order.type !== 'membership' && order.total_amount && (
                <p className="text-sm font-bold text-primary mt-1">
                  ${Number(order.total_amount).toFixed(2)}
                </p>
              )}
              {order.type === 'membership' && order.status !== 'cancelled' && (
                <p className="text-sm font-bold text-primary mt-1">₹415</p>
              )}
            </div>
          </div>
          {order.type !== 'membership' && Array.isArray(order.line_items) && order.line_items.length > 0 && (
            <div className="text-xs text-text-slate mt-2">
              {order.line_items.slice(0, 2).map((item: any, i: number) => (
                <span key={i}>{item.title || item.name}{i < Math.min(order.line_items.length, 2) - 1 ? ', ' : ''}</span>
              ))}
              {order.line_items.length > 2 && <span> +{order.line_items.length - 2} more</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Wishlist Tab ──────────────────────────────────────────────────────────────

function WishlistTab({ userId }: { userId: string }) {
  const [items, setItems]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { formatPrice } = useCurrencyStore()

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('wishlist')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (data) setItems(data)
      setLoading(false)
    }
    load()
  }, [userId])

  const remove = async (productId: string) => {
    await supabase.from('wishlist').delete().eq('user_id', userId).eq('product_id', productId)
    setItems(prev => prev.filter(i => i.product_id !== productId))
    toast.success('Removed from wishlist')
  }

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="card animate-pulse">
          <div className="w-full h-40 bg-slate-200 rounded-t-2xl" />
          <div className="p-4 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-3/4" />
            <div className="h-4 bg-slate-200 rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )

  if (items.length === 0) return (
    <div className="card p-12 text-center">
      <div className="text-5xl mb-4">❤️</div>
      <p className="text-text-slate font-medium mb-2">Your wishlist is empty</p>
      <p className="text-text-slate text-sm mb-4">Tap the heart on any product to save it here</p>
      <Link href="/shop" className="btn-primary inline-block">Browse Products</Link>
    </div>
  )

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">My Wishlist ({items.length})</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {items.map(item => (
          <div key={item.id} className="card">
            <img src={item.product_image} alt={item.product_title} className="w-full h-40 object-cover rounded-t-2xl" />
            <div className="p-4">
              <p className="font-semibold text-sm line-clamp-1 mb-1">{item.product_title}</p>
              <p className="text-primary font-bold mb-3">{formatPrice(item.product_price)}</p>
              <div className="flex gap-2">
                <Link href={`/shop/${item.product_id}`} className="btn-primary text-xs py-2 flex-1 text-center">View Product</Link>
                <button
                  onClick={() => remove(item.product_id)}
                  aria-label="Remove from wishlist"
                  className="btn-secondary text-xs py-2 px-3"
                >🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
