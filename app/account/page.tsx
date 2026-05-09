'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { useCurrencyStore } from '@/store/currencyStore'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TABS = [
  { id: 'overview', label: '👤 Profile' },
  { id: 'orders', label: '📦 Orders' },
  { id: 'wishlist', label: '❤️ Wishlist' },
  { id: 'reviews', label: '⭐ Reviews' },
  { id: 'addresses', label: '📍 Addresses' },
  { id: 'membership', label: '👨‍⚕️ Real Medico+' },
]

const PATREON_URL = 'https://www.patreon.com/therealmedico'

export default function AccountPage() {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login')
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [isMember, setIsMember] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const supabase = getSupabase()
      supabase.auth.getSession().then(async ({ data }) => {
        if (data.session?.user) {
          setUser(data.session.user)
          const { data: membership } = await supabase
            .from('memberships')
            .select('*')
            .eq('user_id', data.session.user.id)
            .eq('active', true)
            .single()
          if (membership) setIsMember(true)
        }
      })
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          const { data: membership } = await supabase
            .from('memberships')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('active', true)
            .single()
          if (membership) setIsMember(true)
        }
      })
    } catch (e) {
      console.error('Supabase init error:', e)
    }
  }, [])

  const update = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const handleAuth = async () => {
    if (!form.email || !form.password) { toast.error('Please fill all fields'); return }
    setLoading(true)
    try {
      const supabase = getSupabase()
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
        const { data, error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        })
        if (error) throw error
        toast.success('Welcome back!')
        if (data.user) setUser(data.user)
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed')
    }
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    const supabase = getSupabase()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/account` },
    })
    if (error) toast.error('Google login failed. Please try again.')
  }

  const handleResetPassword = async () => {
    if (!form.email.trim()) { toast.error('Enter your email address first'); return }
    setLoading(true)
    const supabase = getSupabase()
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
    const supabase = getSupabase()
    await supabase.auth.signOut()
    setUser(null)
    toast.success('Logged out')
  }

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
                <input
                  name="email"
                  type="email"
                  placeholder="Your email address"
                  value={form.email}
                  onChange={update}
                  className="input-field"
                />
                <button onClick={handleResetPassword} disabled={loading} className="btn-primary w-full">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </>
            )}
            <button
              onClick={() => { setMode('login'); setResetSent(false) }}
              className="w-full text-center text-sm text-primary hover:underline"
            >
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
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
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
                <button
                  onClick={() => setMode('reset')}
                  className="text-xs text-primary hover:underline mt-1 block ml-auto"
                >
                  Forgot password?
                </button>
              )}
            </div>

            <button onClick={handleAuth} disabled={loading} className="btn-primary w-full">
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            <p className="text-center text-sm text-text-slate">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-primary font-semibold hover:underline"
              >
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
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Order History</h2>
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-text-slate font-medium mb-2">No orders yet</p>
            <p className="text-text-slate text-sm mb-6">Your orders will appear here after purchase</p>
            <Link href="/shop" className="btn-primary inline-block">Start Shopping</Link>
          </div>
        </div>
      )}

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
          {isMember ? (
            <div className="space-y-4">
              <div className="card p-6 border-2 border-primary">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">⭐</span>
                  <div>
                    <h3 className="font-bold text-primary text-lg">You're a Real Medico+ Member!</h3>
                    <p className="text-text-slate text-sm">Your exclusive community access is active</p>
                  </div>
                </div>
                <a href={PATREON_URL} target="_blank" rel="noopener noreferrer" className="btn-primary w-full text-center block">
                  🎨 Open Real Medico+ on Patreon →
                </a>
              </div>
              <div className="card p-5 bg-accent">
                <p className="text-sm text-text-slate text-center">
                  To manage or cancel your membership, visit your{' '}
                  <a href={PATREON_URL} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">Patreon settings</a>.
                </p>
              </div>
            </div>
          ) : (
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
                <p className="text-blue-200 text-sm mb-6">~$5 · Cancel anytime</p>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/razorpay/subscription', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: user.email, name: user.user_metadata?.name || '' }),
                      })
                      const orderData = await res.json()
                      if (!orderData.order_id) throw new Error('Failed to create order')
                      const options = {
                        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                        amount: orderData.amount,
                        currency: orderData.currency,
                        name: 'The Real Medico',
                        description: 'Real Medico+ Monthly Membership',
                        order_id: orderData.order_id,
                        prefill: { email: user.email, name: user.user_metadata?.name || '' },
                        theme: { color: '#1A3A8F' },
                        handler: async (response: any) => {
                          const verifyRes = await fetch('/api/razorpay/verify-subscription', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...response, user_email: user.email }),
                          })
                          const verifyData = await verifyRes.json()
                          if (verifyData.verified) {
                            setIsMember(true)
                            toast.success('Welcome to Real Medico+! 🎉')
                          } else {
                            toast.error('Payment verification failed')
                          }
                        },
                        modal: { ondismiss: () => toast('Payment cancelled', { icon: 'ℹ️' }) },
                      }
                      const rzp = new (window as any).Razorpay(options)
                      rzp.open()
                    } catch {
                      toast.error('Something went wrong. Please try again.')
                    }
                  }}
                  className="bg-white text-primary font-bold px-8 py-3 rounded-xl hover:bg-accent transition-all w-full text-center block"
                >
                  Join Real Medico+ →
                </button>
                <p className="text-blue-200 text-xs text-center mt-3">🔒 Exclusive membership — not open to general public</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { icon: '🛍️', title: 'Early Access', desc: 'Get access to new products before they launch to the general public. Place orders up to 7 days early.' },
                  { icon: '💰', title: 'Member Discounts', desc: 'Exclusive 15% discount on all products, every order, every time.' },
                  { icon: '📦', title: 'Free Shipping', desc: 'Free shipping on all orders, no minimum order value required.' },
                  { icon: '🔔', title: 'Coming Soon Alerts', desc: 'Be the first to know about upcoming product drops and limited editions.' },
                  { icon: '⚡', title: 'Priority Support', desc: 'Skip the queue — get priority customer support with same-day responses.' },
                  { icon: '🏥', title: 'Community Access', desc: 'Join our exclusive members-only community of healthcare professionals and get insider content.' },
                ].map((benefit) => (
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

function WishlistTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { formatPrice } = useCurrencyStore()

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()
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
    const supabase = getSupabase()
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
