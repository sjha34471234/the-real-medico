'use client'
import Link from 'next/link'
import { useState } from 'react'
import { ShoppingCart, Menu, X, User } from 'lucide-react'
import useCartStore from '@/store/cartStore'
export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const cartCount = useCartStore((s) => s.items.reduce((a, i) => a + i.quantity, 0))
  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm">
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
          <Link href="/trending" className="text-text-dark hover:text-primary font-medium transition-colors flex items-center gap-1">
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
        <div className="flex items-center gap-3">
          {/* Cart */}
          <Link href="/cart" className="relative p-2 hover:bg-accent rounded-lg transition-colors">
            <ShoppingCart className="w-6 h-6 text-text-dark" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </Link>
          {/* Account */}
          <Link href="/account" className="hidden md:flex items-center gap-2 btn-primary text-sm py-2 px-4">
            <User className="w-4 h-4" />
            Account
          </Link>
          {/* Mobile menu button */}
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
          {[
            { href: '/shop', label: '🛍️ Shop' },
            { href: '/trending', label: '🔥 Trending' },
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
          <div className="border-t border-slate-100 mt-2 pt-2">
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
  )
}
