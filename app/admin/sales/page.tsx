// ============================================================
// FILE: app/admin/sales/page.tsx
// PURPOSE: Admin UI for creating, scheduling, pausing, and
//   force-ending SALES+ campaigns
// LAST CHANGED: May 12, 2026
// WHY IT EXISTS: Phase 8 — gives admin full control over sale
//   campaigns without touching code or Supabase dashboard
// DEPENDENCIES: /api/admin/sales route, react-hot-toast
// ⚠️ DO NOT CHANGE: No <form> tags — use onClick handlers only.
//   Admin redirects use window.location.href, not router.push().
// ============================================================

// --- CHANGE LOG ---
// [May 12, 2026] CREATED: Full admin sales dashboard (Phase 8)
// REASON: Admin needs to manage SALES+ campaigns from browser
// --- END CHANGE LOG ---

'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  Tag,
  Plus,
  Play,
  Pause,
  StopCircle,
  Trash2,
  Clock,
  ChevronDown,
  ChevronUp,
  Percent,
  Calendar,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────

interface Sale {
  id: string
  name: string
  color: string
  discount_percent: number
  scope: 'all' | 'specific' | 'category'
  product_ids: string[]
  category: string | null
  start_date: string
  end_date: string
  status: 'scheduled' | 'active' | 'ended' | 'paused'
  created_at: string
}

const STATUS_COLORS: Record<Sale['status'], string> = {
  active: 'bg-green-100 text-green-800',
  scheduled: 'bg-blue-100 text-blue-800',
  paused: 'bg-yellow-100 text-yellow-800',
  ended: 'bg-gray-100 text-gray-500',
}

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#EAB308',
  '#22C55E', '#3B82F6', '#8B5CF6',
  '#EC4899', '#06B6D4',
]

const CATEGORY_OPTIONS = [
  'Scrubs', 'Accessories', 'Stationery', 'Equipment',
  'Bags', 'Footwear', 'Apparel', 'Other',
]

// ─── Helpers ──────────────────────────────────────────────────────────────

function localToISO(local: string): string {
  if (!local) return ''
  return new Date(local).toISOString()
}

function isoToLocal(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function getTimeRemaining(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h remaining`
  return `${h}h ${m}m remaining`
}

// ─── Empty form state ─────────────────────────────────────────────────────

const emptyForm = {
  name: '',
  color: '#EF4444',
  discount_percent: 10,
  scope: 'all' as Sale['scope'],
  product_ids: '',   // comma-separated input
  category: '',
  start_date: '',    // local datetime-local string
  end_date: '',
  startNow: true,
}

// ─── Component ────────────────────────────────────────────────────────────

export default function AdminSalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmEnd, setConfirmEnd] = useState<string | null>(null)

  // ─── Fetch sales ──────────────────────────────────────────────────────

  const fetchSales = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sales')
      const json = await res.json()
      setSales(json.sales ?? [])
    } catch {
      toast.error('Failed to load sales')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSales() }, [fetchSales])

  // ─── Submit new sale ──────────────────────────────────────────────────

  async function handleCreate() {
    if (!form.name.trim()) return toast.error('Sale name is required')
    if (!form.end_date) return toast.error('End date is required')
    if (form.discount_percent < 1 || form.discount_percent > 90)
      return toast.error('Discount must be between 1% and 90%')
    if (form.scope === 'category' && !form.category)
      return toast.error('Please select a category')
    if (form.scope === 'specific' && !form.product_ids.trim())
      return toast.error('Please enter at least one product ID')

    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        color: form.color,
        discount_percent: form.discount_percent,
        scope: form.scope,
        end_date: localToISO(form.end_date),
        product_ids:
          form.scope === 'specific'
            ? form.product_ids.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
        category: form.scope === 'category' ? form.category : null,
      }

      if (!form.startNow && form.start_date) {
        payload.start_date = localToISO(form.start_date)
      }

      const res = await fetch('/api/admin/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      toast.success('Sale created!')
      setForm(emptyForm)
      setShowForm(false)
      fetchSales()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create sale')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Status actions ───────────────────────────────────────────────────

  async function handleAction(id: string, action: 'activate' | 'pause' | 'end') {
    try {
      const res = await fetch('/api/admin/sales', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(
        action === 'end' ? 'Sale ended' :
        action === 'pause' ? 'Sale paused' : 'Sale activated'
      )
      setConfirmEnd(null)
      fetchSales()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this sale permanently?')) return
    try {
      const res = await fetch(`/api/admin/sales?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      toast.success('Sale deleted')
      fetchSales()
    } catch {
      toast.error('Failed to delete sale')
    }
  }

  // ─── Grouped lists ────────────────────────────────────────────────────

  const activeSales = sales.filter((s) => s.status === 'active')
  const scheduledSales = sales.filter((s) => s.status === 'scheduled')
  const pausedSales = sales.filter((s) => s.status === 'paused')
  const endedSales = sales.filter((s) => s.status === 'ended')

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-6 h-6" /> SALES+
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Create and manage sale campaigns
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Sale
        </button>
      </div>

      {/* ── Create form ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Create New Sale</h2>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sale Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Nurses Week Flash Sale"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Discount + Color */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount % *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={form.discount_percent}
                  onChange={(e) =>
                    setForm({ ...form, discount_percent: Number(e.target.value) })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Percent className="absolute right-2.5 top-2.5 w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Banner Color
              </label>
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      aria-label={`Select color ${c}`}
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        form.color === c
                          ? 'border-gray-800 scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                  aria-label="Custom color picker"
                />
              </div>
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Applies To *
            </label>
            <div className="flex gap-3">
              {(['all', 'specific', 'category'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setForm({ ...form, scope: s })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.scope === s
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {s === 'all' ? 'All Products' : s === 'specific' ? 'Specific Products' : 'By Category'}
                </button>
              ))}
            </div>

            {form.scope === 'specific' && (
              <div className="mt-3">
                <label className="block text-xs text-gray-500 mb-1">
                  Printify Product IDs (comma-separated)
                </label>
                <input
                  type="text"
                  value={form.product_ids}
                  onChange={(e) => setForm({ ...form, product_ids: e.target.value })}
                  placeholder="abc123, def456, ..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {form.scope === 'category' && (
              <div className="mt-3">
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select category…</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Start time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Time *
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setForm({ ...form, startNow: true })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.startNow
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                Start Immediately
              </button>
              <button
                onClick={() => setForm({ ...form, startNow: false })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  !form.startNow
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                Schedule Start
              </button>
            </div>
            {!form.startNow && (
              <input
                type="datetime-local"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* End time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date & Time *
            </label>
            <input
              type="datetime-local"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Preview strip */}
          {form.name && (
            <div
              className="rounded-lg px-4 py-2 text-white text-sm font-semibold flex items-center justify-between"
              style={{ backgroundColor: form.color }}
            >
              <span>🔥 {form.name} — {form.discount_percent}% OFF</span>
              <span className="opacity-70 text-xs">Banner preview</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              {submitting ? 'Creating…' : 'Create Sale'}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(emptyForm) }}
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Sales list ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading sales…</div>
      ) : sales.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No sales yet. Create your first sale above.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {[
            { label: '🟢 Active', items: activeSales },
            { label: '🔵 Scheduled', items: scheduledSales },
            { label: '🟡 Paused', items: pausedSales },
            { label: '⚫ Ended', items: endedSales },
          ].map(({ label, items }) =>
            items.length === 0 ? null : (
              <div key={label}>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  {label}
                </h3>
                <div className="space-y-3">
                  {items.map((sale) => (
                    <SaleCard
                      key={sale.id}
                      sale={sale}
                      expanded={expandedId === sale.id}
                      onToggle={() =>
                        setExpandedId(expandedId === sale.id ? null : sale.id)
                      }
                      confirmingEnd={confirmEnd === sale.id}
                      onAction={handleAction}
                      onDelete={handleDelete}
                      onConfirmEnd={() => setConfirmEnd(sale.id)}
                      onCancelEnd={() => setConfirmEnd(null)}
                    />
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sale card sub-component ──────────────────────────────────────────────

interface CardProps {
  sale: Sale
  expanded: boolean
  onToggle: () => void
  confirmingEnd: boolean
  onAction: (id: string, action: 'activate' | 'pause' | 'end') => void
  onDelete: (id: string) => void
  onConfirmEnd: () => void
  onCancelEnd: () => void
}

function SaleCard({
  sale,
  expanded,
  onToggle,
  confirmingEnd,
  onAction,
  onDelete,
  onConfirmEnd,
  onCancelEnd,
}: CardProps) {
  const isLive = sale.status === 'active'
  const isEnded = sale.status === 'ended'

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Color bar */}
      <div className="h-1 w-full" style={{ backgroundColor: sale.color }} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ backgroundColor: sale.color }}
            >
              {sale.discount_percent}%
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{sale.name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[sale.status]}`}
                >
                  {sale.status}
                </span>
                <span className="text-xs text-gray-400 capitalize">
                  {sale.scope === 'all'
                    ? 'All products'
                    : sale.scope === 'category'
                    ? `Category: ${sale.category}`
                    : `${sale.product_ids.length} product(s)`}
                </span>
                {isLive && (
                  <span className="text-xs text-green-600 font-medium">
                    {getTimeRemaining(sale.end_date)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!isEnded && (
              <>
                {sale.status === 'paused' || sale.status === 'scheduled' ? (
                  <ActionBtn
                    icon={<Play className="w-3.5 h-3.5" />}
                    label="Activate sale"
                    color="green"
                    onClick={() => onAction(sale.id, 'activate')}
                  />
                ) : isLive ? (
                  <ActionBtn
                    icon={<Pause className="w-3.5 h-3.5" />}
                    label="Pause sale"
                    color="yellow"
                    onClick={() => onAction(sale.id, 'pause')}
                  />
                ) : null}

                {confirmingEnd ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => onAction(sale.id, 'end')}
                      className="text-xs bg-red-600 text-white px-2 py-1 rounded font-semibold"
                    >
                      Confirm End
                    </button>
                    <button
                      onClick={onCancelEnd}
                      className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <ActionBtn
                    icon={<StopCircle className="w-3.5 h-3.5" />}
                    label="End sale"
                    color="red"
                    onClick={onConfirmEnd}
                  />
                )}
              </>
            )}

            <ActionBtn
              icon={<Trash2 className="w-3.5 h-3.5" />}
              label="Delete sale"
              color="gray"
              onClick={() => onDelete(sale.id)}
            />

            <button
              onClick={onToggle}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm">
            <Detail
              icon={<Calendar className="w-3.5 h-3.5" />}
              label="Starts"
              value={formatDate(sale.start_date)}
            />
            <Detail
              icon={<Clock className="w-3.5 h-3.5" />}
              label="Ends"
              value={formatDate(sale.end_date)}
            />
            <Detail
              icon={<Percent className="w-3.5 h-3.5" />}
              label="Discount"
              value={`${sale.discount_percent}%`}
            />
            <Detail
              icon={<Tag className="w-3.5 h-3.5" />}
              label="Scope"
              value={
                sale.scope === 'all'
                  ? 'All products'
                  : sale.scope === 'category'
                  ? `Category: ${sale.category}`
                  : `${sale.product_ids.length} specific product(s)`
              }
            />
            {sale.scope === 'specific' && sale.product_ids.length > 0 && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-1">Product IDs</p>
                <p className="text-xs text-gray-700 font-mono break-all">
                  {sale.product_ids.join(', ')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ActionBtn({
  icon, label, color, onClick,
}: {
  icon: React.ReactNode
  label: string
  color: 'green' | 'yellow' | 'red' | 'gray'
  onClick: () => void
}) {
  const colors = {
    green: 'text-green-600 hover:bg-green-50',
    yellow: 'text-yellow-600 hover:bg-yellow-50',
    red: 'text-red-500 hover:bg-red-50',
    gray: 'text-gray-400 hover:bg-gray-100',
  }
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`p-1.5 rounded transition-colors ${colors[color]}`}
    >
      {icon}
    </button>
  )
}

function Detail({
  icon, label, value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 flex items-center gap-1 mb-0.5">
        {icon} {label}
      </p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  )
}
