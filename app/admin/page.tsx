'use client'
import { useState, useEffect } from 'react'

const ADMIN_PASSWORD = 'realmedico2024'

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [stats, setStats] = useState({ products: 0, shopId: '' })
  const [loading, setLoading] = useState(false)

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthed(true)
      localStorage.setItem('admin_authed', 'true')
    } else {
      alert('Wrong password')
    }
  }

  useEffect(() => {
    if (localStorage.getItem('admin_authed') === 'true') setAuthed(true)
  }, [])

  const testPrintify = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/printify/products')
      const data = await res.json()
      setStats({ products: data.products?.length || 0, shopId: 'Connected ✅' })
    } catch {
      setStats({ products: 0, shopId: 'Failed ❌' })
    }
    setLoading(false)
  }

  if (!authed) return (
    <div className="max-w-sm mx-auto px-4 py-24">
      <h1 className="text-3xl font-heading font-bold text-primary mb-8 text-center">Admin Login</h1>
      <div className="card p-6 space-y-4">
        <input
          type="password"
          placeholder="Admin Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          className="input-field"
        />
        <button onClick={handleLogin} className="btn-primary w-full">Login</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-heading font-bold text-primary">Admin Dashboard</h1>
        <button
          onClick={() => { localStorage.removeItem('admin_authed'); setAuthed(false) }}
          className="btn-secondary text-sm py-2"
        >
          Logout
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: 'Site Status', value: '🟢 Live', sub: 'therealmedico.store' },
          { label: 'Printify Products', value: stats.products || '—', sub: 'Tap Test to check' },
          { label: 'Payment', value: '🟢 Active', sub: 'Razorpay connected' },
        ].map((stat) => (
          <div key={stat.label} className="card p-6">
            <p className="text-text-slate text-sm mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-primary">{stat.value}</p>
            <p className="text-text-slate text-xs mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-bold text-lg mb-4">Printify Connection</h2>
          <p className="text-text-slate text-sm mb-4">
            Test your Printify API connection and see how many products are synced.
          </p>
          <button onClick={testPrintify} disabled={loading} className="btn-primary w-full">
            {loading ? 'Testing...' : 'Test Printify Connection'}
          </button>
          {stats.shopId && (
            <p className="mt-3 text-sm text-center">
              Status: {stats.shopId} — {stats.products} products found
            </p>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-bold text-lg mb-4">Quick Links</h2>
          <div className="space-y-3">
            {[
              { label: '📦 Printify Dashboard', url: 'https://printify.com/app/store/products/1' },
              { label: '💳 Razorpay Dashboard', url: 'https://dashboard.razorpay.com' },
              { label: '🗄️ Supabase Dashboard', url: 'https://supabase.com/dashboard' },
              { label: '⚡ Vercel Dashboard', url: 'https://vercel.com' },
            ].map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-left px-4 py-2 rounded-lg bg-accent hover:bg-slate-200 text-sm font-medium transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
