'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@supabase/supabase-js'

// Create client inside component file to avoid SSR issues
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AccountPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)

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
    if (!form.email || !form.password) {
      toast.error('Please fill all fields')
      return
    }
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
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/2 mx-auto" />
        <div className="h-64 bg-slate-200 rounded" />
      </div>
    </div>
  )

  if (user) return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="text-6xl mb-4">👤</div>
      <h1 className="text-3xl font-heading font-bold text-primary mb-2">My Account</h1>
      <p className="text-text-slate mb-8">{user.email}</p>
      <div className="card p-6 text-left space-y-4 mb-6">
        <h3 className="font-bold text-lg">Account Details</h3>
        <p className="text-sm text-text-slate">Email: {user.email}</p>
        <p className="text-sm text-text-slate">
          Member since: {new Date(user.created_at).toLocaleDateString()}
        </p>
      </div>
      <button onClick={handleLogout} className="btn-secondary w-full">
        Log Out
      </button>
    </div>
  )

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-3xl font-heading font-bold text-primary mb-2 text-center">
        {mode === 'login' ? 'Welcome Back' : 'Create Account'}
      </h1>
      <p className="text-text-slate text-center mb-8">
        {mode === 'login' ? 'Sign in to your account' : 'Join The Real Medico'}
      </p>
      <div className="card p-6 space-y-4">
        {mode === 'register' && (
          <input
            name="name"
            placeholder="Full Name"
            value={form.name}
            onChange={update}
            className="input-field"
          />
        )}
        <input
          name="email"
          type="email"
          placeholder="Email Address"
          value={form.email}
          onChange={update}
          className="input-field"
        />
        <input
          name="password"
          type="password"
          placeholder="Password (min 6 characters)"
          value={form.password}
          onChange={update}
          onKeyDown={e => e.key === 'Enter' && handleAuth()}
          className="input-field"
        />
        <button
          onClick={handleAuth}
          disabled={loading}
          className="btn-primary w-full"
        >
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
      </div>
    </div>
  )
}
