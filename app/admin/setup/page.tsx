// ============================================================
// FILE: app/admin/setup/page.tsx
// PURPOSE: Change admin password from browser — no code changes needed
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Admin needs to update password without touching env vars or code
// ⚠️ DO NOT CHANGE: Must be accessible at /admin/setup (middleware allows it through)
// ============================================================

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminSetupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (form.newPass !== form.confirm) {
      setError('New passwords do not match')
      return
    }
    if (form.newPass.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.newPass }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to update password')
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => router.push('/admin'), 2000)
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
          <h1 className="text-2xl font-heading font-bold text-primary">Change Password</h1>
          <p className="text-text-slate text-sm mt-1">Update your admin password</p>
        </div>

        {success ? (
          <div className="card p-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-bold text-primary">Password updated!</p>
            <p className="text-text-slate text-sm mt-1">Redirecting to dashboard...</p>
          </div>
        ) : (
          <div className="card p-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-dark mb-2">Current Password</label>
              <input
                type="password"
                placeholder="Your current password"
                value={form.current}
                onChange={e => setForm({ ...form, current: e.target.value })}
                className="input-field"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-dark mb-2">New Password</label>
              <input
                type="password"
                placeholder="Min 8 characters"
                value={form.newPass}
                onChange={e => setForm({ ...form, newPass: e.target.value })}
                className="input-field"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-dark mb-2">Confirm New Password</label>
              <input
                type="password"
                placeholder="Repeat new password"
                value={form.confirm}
                onChange={e => setForm({ ...form, confirm: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="input-field"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !form.current || !form.newPass || !form.confirm}
              className="btn-primary w-full"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>

            <button
              onClick={() => router.push('/admin')}
              className="btn-secondary w-full text-sm"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
