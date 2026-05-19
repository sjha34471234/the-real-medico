// ============================================================
// FILE: app/admin/layout.tsx
// PURPOSE: Admin dashboard shell — sidebar nav, instant logout
// LAST CHANGED: May 19, 2026
// WHY IT EXISTS: Shared layout for all admin/* pages
// ⚠️ DO NOT CHANGE: window.location.href for logout — guarantees cookie cleared
// ============================================================

// --- CHANGE LOG ---
// [May 11, 2026] CREATED: Admin shell with sidebar nav
// [May 19, 2026] UPDATED: Added Coupons nav item
// REASON: Coupon system Tier 3 feature — admin needs to manage coupon codes.
// --- END CHANGE LOG ---

'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Package,
  MessageSquare,
  Search,
  Users,
  Tag,
  Ticket,
  LogOut,
  Menu,
  X,
  Settings,
} from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/admin',                       label: 'Overview',          icon: LayoutDashboard, exact: true },
  { href: '/admin/products',              label: 'Products',          icon: Package },
  { href: '/admin/reviews',               label: 'Reviews',           icon: MessageSquare },
  { href: '/admin/analytics/search',      label: 'Search Analytics',  icon: Search },
  { href: '/admin/analytics/subscriptions', label: 'Subscriptions',   icon: Users },
  { href: '/admin/sales',                 label: 'SALES+',            icon: Tag },
  // [May 19, 2026] REASON: Coupon system — admin needs to create and manage coupons.
  { href: '/admin/coupons',               label: 'Coupons',           icon: Ticket },
  { href: '/admin/setup',                 label: 'Change Password',   icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // [May 11] REASON: window.location.href for logout — hard redirect ensures
  // cookie is cleared and browser doesn't cache the admin page
  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  const isActive = (item: typeof NAV_ITEMS[0]) => {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">RM</span>
          </div>
          <div>
            <p className="font-bold text-primary text-sm">The Real Medico</p>
            <p className="text-xs text-text-slate">Admin Dashboard</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-primary text-white'
                  : 'text-text-slate hover:bg-accent hover:text-primary'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 w-full transition-all"
          aria-label="Logout from admin dashboard"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-accent flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 fixed top-0 left-0 h-full z-40">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 z-50 transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="p-1 rounded-lg hover:bg-accent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Mobile topbar */}
        <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="p-2 rounded-lg hover:bg-accent"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-primary">Admin Dashboard</span>
        </header>

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
