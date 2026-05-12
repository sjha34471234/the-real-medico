'use client'
// ============================================================
// FILE: components/Footer.tsx
// PURPOSE: Store footer
// LAST CHANGED: May 12, 2026
// ⚠️ DO NOT CHANGE: usePathname admin check — prevents footer showing on admin pages
// ============================================================

// --- CHANGE LOG ---
// [May 12, 2026] ADDED: Cross-domain link to Learn World (3D Anatomy)
// --- END CHANGE LOG ---

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Footer() {
  const pathname = usePathname()

  if (pathname?.startsWith('/admin')) return null

  return (
    <footer className="bg-text-dark text-white pt-12 pb-6 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        <div className="md:col-span-2">
          <h3 className="text-xl font-heading font-black text-white mb-3">
            The Real Medico
          </h3>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs mb-4">
            Premium merchandise for healthcare professionals. Wear your passion for medicine with pride.
          </p>
          <div className="flex gap-3">
            <a href="https://instagram.com/therealmedico_" target="_blank" rel="noopener noreferrer"
              className="w-9 h-9 bg-slate-700 hover:bg-primary rounded-lg flex items-center justify-center transition-colors text-sm">
              📸
            </a>
            <a href="https://wa.me/919999999999" target="_blank" rel="noopener noreferrer"
              className="w-9 h-9 bg-slate-700 hover:bg-green-600 rounded-lg flex items-center justify-center transition-colors text-sm">
              💬
            </a>
            <a href="mailto:support@therealmedico.store"
              className="w-9 h-9 bg-slate-700 hover:bg-primary rounded-lg flex items-center justify-center transition-colors text-sm">
              ✉️
            </a>
          </div>
        </div>
        <div>
          <h4 className="font-bold mb-4 text-white">Shop</h4>
          <ul className="space-y-2 text-slate-400 text-sm">
            <li><Link href="/shop" className="hover:text-white transition-colors">All Products</Link></li>
            
            {/* NEW: Learn World Bridge (Footer) */}
            <li>
              <a href="https://learn.therealmedico.store" className="hover:text-white transition-colors flex items-center gap-2">
                Learn (3D Anatomy) <span className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold px-1.5 py-0.5 rounded-full">NEW</span>
              </a>
            </li>

            <li><Link href="/shop?cat=tshirts" className="hover:text-white transition-colors">T-Shirts</Link></li>
            <li><Link href="/shop?cat=hoodies" className="hover:text-white transition-colors">Hoodies</Link></li>
            <li><Link href="/shop?cat=mugs" className="hover:text-white transition-colors">Mugs</Link></li>
            <li><Link href="/account" className="hover:text-white transition-colors">Real Medico+ ⭐</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold mb-4 text-white">Help</h4>
          <ul className="space-y-2 text-slate-400 text-sm">
            <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
            <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
            <li><Link href="/shipping" className="hover:text-white transition-colors">Shipping & Returns</Link></li>
            <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
            <li><Link href="/admin" className="hover:text-white transition-colors text-slate-600">Admin</Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-6xl mx-auto border-t border-slate-700 pt-6 mb-6">
        <div className="flex flex-wrap justify-center gap-6 text-slate-500 text-xs">
          <span>🔒 SSL Secured</span>
          <span>💳 Razorpay Protected</span>
          <span>🖨️ Print on Demand</span>
          <span>↩️ 30-Day Returns</span>
          <span>🇮🇳 Made in India, Made for World</span>
        </div>
      </div>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2 text-slate-500 text-xs">
        <p>© {new Date().getFullYear()} The Real Medico. All rights reserved.</p>
        <div className="flex gap-4">
          <Link href="/shipping" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/shipping" className="hover:text-white transition-colors">Terms of Service</Link>
          <Link href="/shipping" className="hover:text-white transition-colors">Shipping Policy</Link>
        </div>
      </div>
    </footer>
  )
}