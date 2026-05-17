'use client'
// ============================================================
// FILE: app/account/page.tsx
// PURPOSE: Shell tab router — auth gate, user header, tab switcher only.
//   All tab content lives in components/account/.
// LAST CHANGED: May 17, 2026
// WHY IT EXISTS: Central account page. Refactored from ~900-line monolith to
//   shell per modular architecture mandate (May 16, 2026).
// DEPENDENCIES: components/account/* tab components, Supabase anon client
// ⚠️ DO NOT CHANGE: onAuthStateChange pattern — never getUser()/getSession() on mount
// ⚠️ DO NOT CHANGE: membershipChecked ref — prevents duplicate DB calls / flicker
// ⚠️ DO NOT CHANGE: Razorpay script loaded via useEffect here — NOT in layout.tsx
// ⚠️ DO NOT CHANGE: accessTokenRef — stores current session token for API calls
//   that require Authorization: Bearer header (cancel-membership)
// ⚠️ DO NOT CHANGE: memberships uses boolean `active` — NEVER `.eq('status','active')`
// ============================================================

// --- CHANGE LOG ---
// [May 17, 2026] REFACTORED: Split ~900-line monolith into shell + components/account/
// REASON: Modular architecture mandate — one file, one responsibility.
//   Zero logic changed. Tab content extracted to:
//   MembershipTab, CancelFlow, OrdersTab, WishlistTab, ProfileTab, AddressTab
// --- END CHANGE LOG ---

import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

import ProfileTab    from '@/components/account/ProfileTab'
import OrdersTab     from '@/components/account/OrdersTab'
import WishlistTab   from '@/components/account/WishlistTab'
import AddressTab    from '@/components/account/AddressTab'
import MembershipTab from '@/components/account/MembershipTab'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TABS = [
  { id: 'overview',   label: '👤 Profile' },
  { id: 'orders',     label: '📦 Orders' },
  { id: 'wishlist',   label: '❤️ Wishlist' },
  { id: 'reviews',    label: '⭐ Reviews' },
  { id: 'addresses',  label: '📍 Addresses' },
  { id: 'membership', label: '👨‍⚕️ Real Medico+' },
]

async function checkMembership(userId: string): Promise<{ isMember: boolean; expiresAt: string | null }> {
  const { data } = await supabase
    .from('memberships')
    .select('active, expires_at')
    .eq('user_id', userId)
    .eq('active', true)           // ⚠️ boolean column — never .eq('status','active')
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return { isMember: !!data, expiresAt: data?.expires_at || null }
}

export default function AccountPage() {
  const [mode, setMode]       = useState<'login' | 'register' | 'reset'>('login')
  const [form, setForm]       = useState({ email: '', password: '', name: '' })
  const [loading, setLoading] = useState(false)
  const [user, setUser]       = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab]           = useState('overview')
  const [isMember, setIsMember]             = useState(false)
  const [memberExpiresAt, setMemberExpiresAt] = useState<string | null>(null)
  const [memberSince, setMemberSince]       = useState<string | null>(null)
  const [resetSent, setResetSent]           = useState(false)

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

  // ── Render guards ─────────────────────────────────────────────────────────
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

  // ── Authenticated layout ──────────────────────────────────────────────────
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
        <button onClick={handleLogout} className="btn-secondary text-sm py-2 px-4">Log Out</button>
      </div>

      {/* Tab bar */}
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

      {/* Tab content — each tab is its own component */}
      {activeTab === 'overview'   && <ProfileTab user={user} isMember={isMember} />}
      {activeTab === 'orders'     && <OrdersTab userId={user.id} accessToken={accessTokenRef.current} />}
      {activeTab === 'wishlist'   && <WishlistTab userId={user.id} />}
      {activeTab === 'addresses'  && <AddressTab />}

      {activeTab === 'reviews' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">My Reviews</h2>
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">⭐</div>
            <p className="text-text-slate font-medium mb-2">No reviews yet</p>
            <p className="text-text-slate text-sm mb-6">
              Reviews will appear here after you purchase and review products
            </p>
            <Link href="/shop" className="btn-primary inline-block">Shop &amp; Review</Link>
          </div>
        </div>
      )}

      {activeTab === 'membership' && (
        <MembershipTab
          user={user}
          isMember={isMember}
          memberExpiresAt={memberExpiresAt}
          memberSince={memberSince}
          accessToken={accessTokenRef.current}
          onJoinSuccess={(expiresAt) => {
            setIsMember(true)
            setMemberExpiresAt(expiresAt)
            membershipChecked.current = user.id
          }}
          onCancelSuccess={(accessUntil) => {
            setIsMember(false)
            membershipChecked.current = null
          }}
        />
      )}
    </div>
  )
}
