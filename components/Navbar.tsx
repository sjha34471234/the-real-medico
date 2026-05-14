'use client'
// ============================================================
// FILE: components/Navbar.tsx
// PURPOSE: Store navigation bar
// LAST CHANGED: May 13, 2026
// WHY IT EXISTS: Main store nav
// ⚠️ DO NOT CHANGE: usePathname admin check — prevents navbar showing on admin pages
// ⚠️ DO NOT CHANGE: SaleBanner must render OUTSIDE <nav> — keeps nav height stable
// ⚠️ DO NOT CHANGE: External links use <a> NOT <Link> — Next.js Link is internal only
// ============================================================

// --- CHANGE LOG ---
// [May 12, 2026] ADDED: SaleBanner above nav for SALES+ Phase 8
// [May 12, 2026] ADDED: Learn 3D link to learn.therealmedico.store
// [May 13, 2026] FIXED: Mobile menu used <Link> for external URL — changed to <a>
//   Next.js Link does not support external href — causes build warnings + broken nav
// --- END CHANGE LOG ---

import CurrencySelector from '@/components/CurrencySelector'
import { useCurrencyStore } from '@/store/currencyStore'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ShoppingCart, Menu, X, User, Search } from 'lucide-react'
import useCartStore from '@/store/cartStore'
import SaleBanner from './SaleBanner'

function SearchButton() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 hover:bg-accent rounded-lg transition-colors"
        aria-label="Search products"
      >
        <Search className="w-6 h-6 text-text-dark" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-4"
            onClick={e => e.stopPropagation()}
          >
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-slate" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search medical merchandise..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-primary text-base"
                />
              </div>
              <button type="submit" className="btn-primary px-5">
                Search
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-3 hover:bg-accent rounded-xl"
                aria-label="Close search"
              >
                <X className="w-5 h-5" />
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <span className="text-xs text-text-slate">Popular:</span>
              {['stethoscope', 't-shirt', 'mug', 'hoodie', 'doctor'].map(term => (
                <button
                  key={term}
                  onClick={() => {
                    router.push(`/search?q=${term}`)
                    setOpen(false)
                    setQuery('')
                  }}
                  className="text-xs bg-accent text-primary px-3 py-1 rounded-full hover:bg-primary hover:text-white transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function Navbar() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const cartCount = useCartStore((s) => s.items.reduce((a, i) => a + i.quantity, 0))
  const { initCurrency } = useCurrencyStore()

  useEffect(() => {
    initCurrency()
  }, [])

  // [May 11, 2026] REASON: Admin has its own sidebar — store navbar must not render there
  if (pathname?.startsWith('/admin')) return null

  return (
    <>
      {/* [May 12, 2026] REASON: SaleBanner outside <nav> so nav height stays fixed */}
      <SaleBanner />

      <nav className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-heading font-black text-primary">
              The Real Medico
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/shop" className="text-text-dark hover:text-primary font-medium transition-colors">
              Shop
            </Link>

            {/* [May 13, 2026] REASON: External URL — must use <a> not <Link> */}
            <a
              href="https://learn.therealmedico.store"
              className="text-text-dark hover:text-primary font-medium transition-colors flex items-center gap-1"
            >
              Learn <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase">3D</span>
            </a>

            {/* [May 14, 2026] REASON: Community micro-frontend link */}
            <a
              href="https://community.therealmedico.store"
              className="text-text-dark hover:text-primary font-medium transition-colors flex items-center gap-1"
            >
              Community <span className="bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase">New</span>
            </a>

            <Link href="/trending" className="text-text-dark hover:text-primary font-medium transition-colors">
              🔥 Trending
            </Link>
            <Link href="/about" className="text-text-dark hover:text-primary font-medium transition-colors">
              About
            </Link>
            <Link href="/contact" className="text-text-dark hover:text-primary font-medium transition-colors">
              Contact
            </Link>
            <Link href="/faq" className="text-text-dark hover:text-primary font-medium transition-colors">
              FAQ
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <CurrencySelector variant="navbar" />
            <SearchButton />

            <Link
              href="/cart"
              className="relative p-2 hover:bg-accent rounded-lg transition-colors"
              aria-label="Shopping cart"
            >
              <ShoppingCart className="w-6 h-6 text-text-dark" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Link>

            <Link
              href="/account"
              className="hidden md:flex items-center gap-2 btn-primary text-sm py-2 px-4"
              aria-label="My account"
            >
              <User className="w-4 h-4" />
              Account
            </Link>

            <button
              className="md:hidden p-2 hover:bg-accent rounded-lg transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 flex flex-col gap-1">

            {/* [May 13, 2026] REASON: Internal links use Link, external use <a> */}
            {[
              { href: '/shop', label: '🛍️ Shop' },
              { href: '/trending', label: '🔥 Trending' },
              { href: '/search', label: '🔍 Search' },
              { href: '/about', label: '👥 About' },
              { href: '/contact', label: '📧 Contact' },
              { href: '/faq', label: '❓ FAQ' },
              { href: '/account', label: '👤 My Account' },
            ].map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="font-medium text-text-dark hover:text-primary hover:bg-accent px-3 py-3 rounded-lg transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}

            {/* [May 13, 2026] REASON: External — plain <a> tag required */}
            <a
              href="https://learn.therealmedico.store"
              className="font-medium text-text-dark hover:text-primary hover:bg-accent px-3 py-3 rounded-lg transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              🧠 Learn 3D
            </a>

            {/* [May 14, 2026] REASON: Community micro-frontend link */}
            <a
              href="https://community.therealmedico.store"
              className="font-medium text-text-dark hover:text-primary hover:bg-accent px-3 py-3 rounded-lg transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              💬 Community
            </a>

            <div className="border-t border-slate-100 mt-2 pt-2">
              <div className="flex items-center justify-between px-3 py-3">
                <span className="font-medium text-text-dark">Currency</span>
                <CurrencySelector variant="navbar" />
              </div>
              <Link
                href="/cart"
                className="flex items-center gap-2 font-medium text-primary hover:bg-accent px-3 py-3 rounded-lg transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                <ShoppingCart className="w-4 h-4" />
                Cart {cartCount > 0 && `(${cartCount})`}
              </Link>
            </div>
          </div>
        )}
      </nav>
    </>
  )
}
