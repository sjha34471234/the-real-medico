'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

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

export default function AccountPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [isMember, setIsMember] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const supabase = getSupabase()
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) setUser(data.session.user)
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
        toast.success('Account created!')
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
        {mode === 'login' ? 'Welcome Back' : 'Create Account'}
      </h1>
      <p className="text-text-slate text-center mb-8">
        {mode === 'login' ? 'Sign in to your account' : 'Join The Real Medico'}
      </p>
      <div className="card p-6 space-y-4">
        {mode === 'register' && (
          <input name="name" placeholder="Full Name" value={form.name} onChange={update} className="input-field" />
        )}
        <input name="email" type="email" placeholder="Email Address" value={form.email} onChange={update} className="input-field" />
        <input name="password" type="password" placeholder="Password (min 6 characters)" value={form.password} onChange={update} onKeyDown={e => e.key === 'Enter' && handleAuth()} className="input-field" />
        <button onClick={handleAuth} disabled={loading} className="btn-primary w-full">
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
        <p className="text-center text-sm text-text-slate">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-primary font-semibold hover:underline">
            {mode === 'login' ? 'Register' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold">
            {user.email[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-primary">
              {user.user_metadata?.name || 'My Account'}
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
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'bg-accent text-primary hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}

      {/* PROFILE */}
      {activeTab === 'overview' && (
        <div className="card p-6 space-y-4">
          <h2 className="text-xl font-bold mb-4">Profile Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-slate mb-1 block">Full Name</label>
              <p className="input-field bg-slate-50">{user.user_metadata?.name || '—'}</p>
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
            <Link href="/shop" className="btn-primary inline-block">
              Start Shopping
            </Link>
          </div>
        </div>
      )}

     {/* WISHLIST */}
{activeTab === 'wishlist' && (
  <WishlistTab userId={user.id} />
)}


      {/* REVIEWS */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">My Reviews</h2>
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">⭐</div>
            <p className="text-text-slate font-medium mb-2">No reviews yet</p>
            <p className="text-text-slate text-sm mb-6">Reviews will appear here after you purchase and review products</p>
            <Link href="/shop" className="btn-primary inline-block">
              Shop & Review
            </Link>
          </div>
        </div>
      )}

      {/* ADDRESSES */}
      {activeTab === 'addresses' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Saved Addresses</h2>
            <button
              onClick={() => toast.success('Address saving coming soon!')}
              className="btn-primary text-sm py-2 px-4"
            >
              + Add Address
            </button>
          </div>
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">📍</div>
            <p className="text-text-slate font-medium mb-2">No saved addresses</p>
            <p className="text-text-slate text-sm">Save your address for faster checkout</p>
          </div>
        </div>
      )}

      {/* MEMBERSHIP */}
      {activeTab === 'membership' && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold">Real Medico+ Membership</h2>

          {isMember ? (
            <div className="card p-6 border-2 border-primary">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">⭐</span>
                <div>
                  <h3 className="font-bold text-primary text-lg">You're a Real Medico+ Member!</h3>
                  <p className="text-text-slate text-sm">Active subscription — $5/month</p>
                </div>
              </div>
              <button
                onClick={() => { setIsMember(false); toast.success('Subscription cancelled') }}
                className="btn-secondary text-sm"
              >
                Cancel Subscription
              </button>
            </div>
          ) : (
            <>
              {/* Membership Card */}
              <div className="bg-gradient-to-br from-primary to-primary-dark text-white rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-4xl">👨‍⚕️</span>
                  <div>
                    <h3 className="text-2xl font-heading font-black">Real Medico+</h3>
                    <p className="text-blue-200">Premium membership for healthcare professionals</p>
                  </div>
                </div>
                <div className="text-4xl font-black mb-1">$5<span className="text-xl font-normal text-blue-200">/month</span></div>
                <p className="text-blue-200 text-sm mb-6">Cancel anytime</p>
                <button
                 onClick={async () => {
  try {
    const res = await fetch('/api/razorpay/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        name: user.user_metadata?.name || '',
      }),
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
      prefill: {
        email: user.email,
        name: user.user_metadata?.name || '',
      },
      theme: { color: '#1A3A8F' },
      handler: async (response: any) => {
        const verifyRes = await fetch('/api/razorpay/verify-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...response,
            user_email: user.email,
          }),
        })
        const verifyData = await verifyRes.json()
        if (verifyData.verified) {
          setIsMember(true)
          toast.success('Welcome to Real Medico+! 🎉')
        } else {
          toast.error('Payment verification failed')
        }
      },
      modal: {
        ondismiss: () => toast('Payment cancelled', { icon: 'ℹ️' }),
      },
    }
    const rzp = new (window as any).Razorpay(options)
    rzp.open()
  } catch (err) {
    toast.error('Something went wrong. Please try again.')
  }
}}

                  className="bg-white text-primary font-bold px-8 py-3 rounded-xl hover:bg-accent transition-all w-full text-center"
                >
                  Join Real Medico+ →
                </button>
              </div>

              {/* Benefits */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    icon: '🛍️',
                    title: 'Early Access',
                    desc: 'Get access to new products before they launch to the general public. Place orders up to 7 days early.'
                  },
                  {
                    icon: '💰',
                    title: 'Member Discounts',
                    desc: 'Exclusive 15% discount on all products, every order, every time.'
                  },
                  {
                    icon: '📦',
                    title: 'Free Shipping',
                    desc: 'Free shipping on all orders, no minimum order value required.'
                  },
                  {
                    icon: '🔔',
                    title: 'Coming Soon Alerts',
                    desc: 'Be the first to know about upcoming product drops and limited editions.'
                  },
                  {
                    icon: '⚡',
                    title: 'Priority Support',
                    desc: 'Skip the queue — get priority customer support with same-day responses.'
                  },
                  {
                    icon: '🏥',
                    title: 'Community Access',
                    desc: 'Join our exclusive community of healthcare professionals and get insider content.'
                  },
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

              <div className="card p-6 bg-accent">
                <h3 className="font-bold mb-3">Coming Soon Products — Members Only Preview</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { name: 'Surgeon Scrub Cap', price: '$24.99', date: 'June 2026' },
                    { name: 'Medical Lab Coat', price: '$89.99', date: 'July 2026' },
                    { name: 'Doctor Tote Bag', price: '$34.99', date: 'July 2026' },
                  ].map((product) => (
                    <div key={product.name} className="bg-white rounded-xl p-4 text-center">
                      <div className="w-full h-24 bg-slate-100 rounded-lg mb-3 flex items-center justify-center text-3xl">
                        🔒
                      </div>
                      <p className="font-semibold text-sm">{product.name}</p>
                      <p className="text-primary font-bold">{product.price}</p>
                      <p className="text-text-slate text-xs">Available {product.date}</p>
                      <button
                        onClick={() => toast.error('Join Real Medico+ to pre-order!')}
                        className="mt-2 text-xs text-primary font-medium hover:underline"
                      >
                        Pre-order →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
