// ============================================================
// FILE: app/admin/page.tsx
// PURPOSE: Admin dashboard overview — stats, quick links, API status
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Replaces old client-side password admin page
// DEPENDENCIES: admin/layout.tsx handles auth — this page assumes authed
// ⚠️ DO NOT CHANGE: No auth check here — middleware + layout handle it
// ============================================================

'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Package,
  MessageSquare,
  Search,
  Users,
  Tag,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react'

const QUICK_LINKS = [
  { label: 'Printify Dashboard', url: 'https://printify.com/app/store/products/1', emoji: '📦' },
  { label: 'Razorpay Dashboard', url: 'https://dashboard.razorpay.com', emoji: '💳' },
  { label: 'Supabase Dashboard', url: 'https://supabase.com/dashboard', emoji: '🗄️' },
  { label: 'Vercel Dashboard', url: 'https://vercel.com', emoji: '⚡' },
  { label: 'Google Analytics', url: 'https://analytics.google.com', emoji: '📊' },
  { label: 'Microsoft Clarity', url: 'https://clarity.microsoft.com', emoji: '🔍' },
]

const DASHBOARD_SECTIONS = [
  { href: '/admin/products', label: 'Products', desc: 'Filter, sort, manage visibility', icon: Package, color: 'bg-blue-50 text-blue-600' },
  { href: '/admin/reviews', label: 'Reviews', desc: 'Reply as The Real Medico', icon: MessageSquare, color: 'bg-green-50 text-green-600' },
  { href: '/admin/analytics/search', label: 'Search Analytics', desc: 'What customers are searching', icon: Search, color: 'bg-purple-50 text-purple-600' },
  { href: '/admin/analytics/subscriptions', label: 'Subscriptions', desc: 'Membership performance', icon: Users, color: 'bg-amber-50 text-amber-600' },
  { href: '/admin/sales', label: 'SALES+', desc: 'Create & manage sales', icon: Tag, color: 'bg-red-50 text-red-600' },
]

export default function AdminOverviewPage() {
  const [apiStatus, setApiStatus] = useState<{
    printify?: { ok: boolean; count: number }
    supabase?: { ok: boolean }
    loading: boolean
  }>({ loading: false })

  const testApis = async () => {
    setApiStatus({ loading: true })
    const results: typeof apiStatus = { loading: false }

    // Test Printify
    try {
      const res = await fetch('/api/printify/products')
      const data = await res.json()
      results.printify = { ok: res.ok, count: data.products?.length || 0 }
    } catch {
      results.printify = { ok: false, count: 0 }
    }

    // Test Supabase (via verify endpoint)
    try {
      const res = await fetch('/api/admin/verify')
      results.supabase = { ok: res.ok }
    } catch {
      results.supabase = { ok: false }
    }

    setApiStatus(results)
  }

  const revalidateCache = async () => {
    try {
      await fetch(`/api/revalidate?secret=${process.env.NEXT_PUBLIC_REVALIDATE_SECRET || 'therealmedico_revalidate_2026'}`)
      alert('Cache revalidated ✅')
    } catch {
      alert('Revalidation failed ❌')
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-primary">Dashboard Overview</h1>
        <p className="text-text-slate text-sm mt-1">Welcome back. Here's your store at a glance.</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Site', value: '🟢 Live', sub: 'therealmedico.store' },
          { label: 'Payments', value: '🟢 Active', sub: 'Razorpay' },
          { label: 'Print-on-Demand', value: '🟢 Synced', sub: 'Printify' },
          { label: 'Auth', value: '🟢 Running', sub: 'Supabase' },
        ].map(stat => (
          <div key={stat.label} className="card p-5">
            <p className="text-text-slate text-xs mb-1">{stat.label}</p>
            <p className="text-lg font-bold text-primary">{stat.value}</p>
            <p className="text-text-slate text-xs mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Dashboard Sections */}
      <div>
        <h2 className="font-bold text-text-dark mb-4">Dashboard Sections</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DASHBOARD_SECTIONS.map(section => {
            const Icon = section.icon
            return (
              <Link key={section.href} href={section.href} className="card p-5 hover:shadow-md transition-shadow group">
                <div className={`w-10 h-10 rounded-xl ${section.color} flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="font-bold text-text-dark group-hover:text-primary transition-colors">{section.label}</p>
                <p className="text-text-slate text-sm mt-0.5">{section.desc}</p>
              </Link>
            )
          })}
        </div>
      </div>

      {/* API Health Check */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-text-dark">API Health</h2>
          <div className="flex gap-2">
            <button
              onClick={testApis}
              disabled={apiStatus.loading}
              className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${apiStatus.loading ? 'animate-spin' : ''}`} />
              {apiStatus.loading ? 'Testing...' : 'Run Tests'}
            </button>
            <button
              onClick={revalidateCache}
              className="btn-secondary text-sm py-2 px-4"
            >
              Revalidate Cache
            </button>
          </div>
        </div>

        {apiStatus.printify !== undefined && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              {apiStatus.printify.ok
                ? <CheckCircle className="w-4 h-4 text-green-500" />
                : <XCircle className="w-4 h-4 text-red-500" />
              }
              <span className="font-medium">Printify API</span>
              {apiStatus.printify.ok && (
                <span className="text-text-slate">— {apiStatus.printify.count} products synced</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm">
              {apiStatus.supabase?.ok
                ? <CheckCircle className="w-4 h-4 text-green-500" />
                : <XCircle className="w-4 h-4 text-red-500" />
              }
              <span className="font-medium">Supabase</span>
              {apiStatus.supabase?.ok && <span className="text-text-slate">— Connected</span>}
            </div>
          </div>
        )}

        {apiStatus.printify === undefined && !apiStatus.loading && (
          <p className="text-text-slate text-sm">Click "Run Tests" to check API connectivity.</p>
        )}
      </div>

      {/* Quick Links */}
      <div className="card p-6">
        <h2 className="font-bold text-text-dark mb-4">Quick Links</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {QUICK_LINKS.map(link => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-accent hover:bg-slate-200 text-sm font-medium transition-colors"
            >
              <span>{link.emoji}</span>
              <span className="flex-1 truncate">{link.label}</span>
              <ExternalLink className="w-3 h-3 text-text-slate flex-shrink-0" />
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
