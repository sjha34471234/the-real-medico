// ============================================================
// FILE: app/admin/login/page.tsx
// PURPOSE: Admin login UI — instant redirect on success
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Replaces old plaintext password check
// ⚠️ DO NOT CHANGE: No localStorage auth — session is httpOnly cookie only
// ============================================================

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!password.trim() || loading) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      // [May 11] REASON: Use window.location for hard redirect — guarantees
      // cookie is sent on next request. router.push() can race with cookie set.
      if (data.needsSetup) {
        window.location.href = '/admin/setup'
      } else {
        window.location.href = '/admin'
      }
    } catch {
      setError('Network error. Try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">RM</span>
          </div>
          <h1 className="text-2xl font-heading font-bold text-primary">Admin Access</h1>
          <p className="text-text-slate text-sm mt-1">The Real Medico</p>
        </div>

        <div className="card p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-dark mb-2">
              Admin Password
            </label>
            <input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="input-field"
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !password.trim()}
            className="btn-primary w-full"
          >
            {loading ? 'Verifying...' : 'Login'}
          </button>
        </div>

        <p className="text-center text-xs text-text-slate mt-6">
          Protected area — authorised access only
        </p>
      </div>
    </div>
  )
}
