'use client'
import Link from 'next/link'
import { useState } from 'react'
import { ShoppingCart, Menu, X } from 'lucide-react'
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
        <div className="hidden md:flex items-center gap-8">
          <Link href="/shop" className="text-text-dark hover:text-primary font-medium transition-colors">Shop</Link>
          <Link href="/about" className="text-text-dark hover:text-primary font-medium transition-colors">About</Link>
          <Link href="/contact" className="text-text-dark hover:text-primary font-medium transition-colors">Contact</Link>
        </div>

        {/* Right Icons */}
        <div className="flex items-center gap-4">
          <Link href="/cart" className="relative p-2">
            <ShoppingCart className="w-6 h-6 text-text-dark hover:text-primary transition-colors" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </Link>
          <Link href="/account" className="hidden md:block btn-primary text-sm py-2 px-4">
            Account
          </Link>
          {/* Mobile Menu Button */}
          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 flex flex-col gap-4">
          <Link href="/shop" className="font-medium text-text-dark" onClick={() => setMenuOpen(false)}>Shop</Link>
          <Link href="/about" className="font-medium text-text-dark" onClick={() => setMenuOpen(false)}>About</Link>
          <Link href="/contact" className="font-medium text-text-dark" onClick={() => setMenuOpen(false)}>Contact</Link>
          <Link href="/account" className="font-medium text-text-dark" onClick={() => setMenuOpen(false)}>Account</Link>
        </div>
      )}
    </nav>
  )
}
