'use client'
// ============================================================
// FILE: app/admin/coupons/page.tsx
// PURPOSE: Admin UI — create, list, toggle, and delete coupon codes.
// LAST CHANGED: May 19, 2026
// WHY IT EXISTS: Admin needs to manage coupon campaigns without touching Supabase directly.
// DEPENDENCIES: /api/admin/coupons
// ⚠️ DO NOT CHANGE: All fetch calls include credentials: 'include' — Safari/iPad
//   drops cookies without it. Same rule as all other admin pages.
// ⚠️ DO NOT CHANGE: window.location.href for redirects — NOT router.push().
//   Same rule as all other admin pages.
// ============================================================

// --- CHANGE LOG ---
// [May 19, 2026] CREATED: New admin page for coupon management
// REASON: Coupon system Tier 3 feature.
// --- END CHANGE LOG ---

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface Coupon {
  id:               string
  code:             string
  type:             'percent' | 'fixed' | 'shipping'
  value:            number
  min_order_usd:    number
  max_uses:         number | null
  uses:             number
  one_per_user:     boolean
  members_only:     boolean
  non_members_only: boolean
  expires_at:       string | null
  active:           boolean
  created_at:       string
}

const EMPTY_FORM = {
  code:             '',
  type:             'percent' as Coupon['type'],
  value:            10,
  min_order_usd:    0,
  max_uses:         '' as string | number,
  one_per_user:     true,
  members_only:     false,
  non_members_only: false,
  expires_at:       '',
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons]     = useState<Coupon[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ ...EMPTY_FORM })

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/coupons', { credentials: 'include' })
    if (res.status === 401) { window.location.href = '/admin/login'; return }
    const data = await res.json()
    setCoupons(data.coupons ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.code.trim()) { toast.error('Code is required.'); return }
    if (form.type !== 'shipping' && (!form.value || Number(form.value) <= 0)) {
      toast.error('Value must be positive.'); return
    }
    if (form.members_only && form.non_members_only) {
      toast.error('Coupon cannot be both members-only and non-members-only.'); return
    }
    setSaving(true)
    const res = await fetch('/api/admin/coupons', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        value:         form.type === 'shipping' ? 0 : Number(form.value),
        max_uses:      form.max_uses === '' ? null : Number(form.max_uses),
        expires_at:    form.expires_at || null,
        min_order_usd: Number(form.min_order_usd),
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to create coupon.'); setSaving(false); return }
    toast.success(`Coupon "${data.coupon.code}" created!`)
    setForm({ ...EMPTY_FORM })
    setShowForm(false)
    setSaving(false)
    load()
  }

  const toggleActive = async (coupon: Coupon) => {
    const res = await fetch('/api/admin/coupons', {
      method:      'PATCH',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: coupon.id, active: !coupon.active }),
    })
    if (!res.ok) { toast.error('Failed to update coupon.'); return }
    toast.success(coupon.active ? 'Coupon deactivated.' : 'Coupon activated.')
    load()
  }

  const handleDelete = async (coupon: Coupon) => {
    if (!confirm(`Delete coupon "${coupon.code}"? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/coupons?id=${coupon.id}`, {
      method: 'DELETE', credentials: 'include',
    })
    if (!res.ok) { toast.error('Failed to delete coupon.'); return }
    toast.success('Coupon deleted.')
    load()
  }

  const typeBadge = (type: Coupon['type'], value: number) => {
    if (type === 'percent')  return <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{value}% OFF</span>
    if (type === 'fixed')    return <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">${value} OFF</span>
    return <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">FREE SHIPPING</span>
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary">🏷️ Coupon Codes</h1>
          <p className="text-text-slate mt-1">Create and manage discount coupons</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="btn-primary"
        >
          {showForm ? '✕ Cancel' : '+ New Coupon'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card p-6 mb-8 space-y-5">
          <h2 className="text-xl font-bold">Create New Coupon</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Code */}
            <div>
              <label className="text-sm font-medium text-text-slate block mb-1">Code *</label>
              <input
                type="text"
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="WELCOME15"
                className="input-field font-mono uppercase tracking-widest"
                maxLength={32}
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-sm font-medium text-text-slate block mb-1">Discount Type *</label>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value as Coupon['type'], value: 10 })}
                className="input-field"
              >
                <option value="percent">% Percent off</option>
                <option value="fixed">Fixed $ amount off</option>
                <option value="shipping">Free shipping only</option>
              </select>
            </div>

            {/* Value — hidden for shipping type */}
            {form.type !== 'shipping' && (
              <div>
                <label className="text-sm font-medium text-text-slate block mb-1">
                  {form.type === 'percent' ? 'Discount %' : 'Amount (USD)'} *
                </label>
                <input
                  type="number"
                  value={form.value}
                  onChange={e => setForm({ ...form, value: Number(e.target.value) })}
                  min={1}
                  max={form.type === 'percent' ? 100 : undefined}
                  className="input-field"
                />
              </div>
            )}

            {/* Min order */}
            <div>
              <label className="text-sm font-medium text-text-slate block mb-1">Min Order (USD)</label>
              <input
                type="number"
                value={form.min_order_usd}
                onChange={e => setForm({ ...form, min_order_usd: Number(e.target.value) })}
                min={0}
                placeholder="0"
                className="input-field"
              />
            </div>

            {/* Max uses */}
            <div>
              <label className="text-sm font-medium text-text-slate block mb-1">Max Uses (leave blank = unlimited)</label>
              <input
                type="number"
                value={form.max_uses}
                onChange={e => setForm({ ...form, max_uses: e.target.value })}
                min={1}
                placeholder="Unlimited"
                className="input-field"
              />
            </div>

            {/* Expiry */}
            <div>
              <label className="text-sm font-medium text-text-slate block mb-1">Expires At (optional)</label>
              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={e => setForm({ ...form, expires_at: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-6 pt-1">
            {[
              { label: 'One use per user',      key: 'one_per_user'     },
              { label: 'Members only',          key: 'members_only'     },
              { label: 'Non-members only',      key: 'non_members_only' },
            ].map(({ label, key }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!(form as any)[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm font-medium text-text-dark">{label}</span>
              </label>
            ))}
          </div>

          <button
            onClick={handleCreate}
            disabled={saving}
            className="btn-primary w-full sm:w-auto"
          >
            {saving ? '⏳ Creating…' : '✓ Create Coupon'}
          </button>
        </div>
      )}

      {/* Coupon list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse h-16 bg-slate-100" />
          ))}
        </div>
      ) : coupons.length === 0 ? (
        <div className="card p-12 text-center text-text-slate">
          <div className="text-5xl mb-4">🏷️</div>
          <p className="font-semibold text-lg">No coupons yet</p>
          <p className="text-sm mt-1">Create your first coupon above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map(c => (
            <div
              key={c.id}
              className={`card p-4 flex flex-wrap items-center gap-4 ${!c.active ? 'opacity-50' : ''}`}
            >
              {/* Code + type badge */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="font-mono font-black text-primary text-lg tracking-widest">
                  {c.code}
                </span>
                {typeBadge(c.type, c.value)}
                {c.members_only    && <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-0.5 rounded-full">⭐ Members</span>}
                {c.non_members_only && <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">Non-members</span>}
                {!c.active && <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">Inactive</span>}
              </div>

              {/* Stats */}
              <div className="text-xs text-text-slate space-y-0.5 shrink-0">
                <p>Uses: <strong>{c.uses}</strong>{c.max_uses ? ` / ${c.max_uses}` : ''}</p>
                {c.min_order_usd > 0 && <p>Min order: ${c.min_order_usd}</p>}
                {c.expires_at && (
                  <p className={new Date(c.expires_at) < new Date() ? 'text-red-500 font-semibold' : ''}>
                    Expires: {new Date(c.expires_at).toLocaleDateString()}
                  </p>
                )}
                {c.one_per_user && <p>1 per user</p>}
              </div>

              {/* Actions */}
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => toggleActive(c)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    c.active
                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {c.active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(c)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
