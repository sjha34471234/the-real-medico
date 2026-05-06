import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-text-dark text-white pt-12 pb-6 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        <div className="md:col-span-2">
          <h3 className="text-xl font-heading font-black text-white mb-3">The Real Medico</h3>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
            Premium merchandise for healthcare professionals. Wear your passion for medicine with pride.
          </p>
        </div>
        <div>
          <h4 className="font-bold mb-4 text-white">Shop</h4>
          <ul className="space-y-2 text-slate-400 text-sm">
            <li><Link href="/shop" className="hover:text-white transition-colors">All Products</Link></li>
            <li><Link href="/shop?cat=tshirts" className="hover:text-white transition-colors">T-Shirts</Link></li>
            <li><Link href="/shop?cat=hoodies" className="hover:text-white transition-colors">Hoodies</Link></li>
            <li><Link href="/shop?cat=mugs" className="hover:text-white transition-colors">Mugs</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold mb-4 text-white">Help</h4>
          <ul className="space-y-2 text-slate-400 text-sm">
            <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
            <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
            <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-700 pt-6 text-center text-slate-500 text-sm">
        © {new Date().getFullYear()} The Real Medico. All rights reserved.
      </div>
    </footer>
  )
}
