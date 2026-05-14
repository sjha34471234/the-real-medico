// ============================================================
// FILE: components/HomeClient.tsx
// PURPOSE: Homepage client — hero, how it works, featured products, newsletter
// LAST CHANGED: May 13, 2026
// WHY IT EXISTS: Client-side interactivity for homepage (newsletter, LCP preload, product cards)
// DEPENDENCIES: ProductCard, lib/activeSale.ts, supabase auth, cartStore
// ⚠️ DO NOT CHANGE: LCP preload useEffect — injects <link> into <head> for first product image
// ⚠️ DO NOT CHANGE: onAuthStateChange pattern for membership check (never getSession on mount)
// ⚠️ DO NOT CHANGE: fetchActiveSale called ONCE here, not inside each ProductCard
// ============================================================

// --- CHANGE LOG ---
// [May 13, 2026] CHANGED: Fetch activeSale + membership status once, pass to all ProductCards
// REASON: SALES+ system now active — homepage featured products must reflect live discounts
// --- END CHANGE LOG ---

'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import ProductCard from './ProductCard'
import toast from 'react-hot-toast'
import { fetchActiveSale } from '@/lib/activeSale'

// May 13, 2026 REASON: Single instance — not recreated on every render
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function HomeClient({
  featuredProducts,
  firstImage,
}: {
  featuredProducts: any[]
  firstImage?: string | null
}) {
  const [email, setEmail] = useState('')
  const [subscribing, setSubscribing] = useState(false)

  // May 13, 2026 REASON: Active sale + membership fetched once here, not per ProductCard
  const [activeSale, setActiveSale] = useState<any>(null)
  const [isMember, setIsMember] = useState(false)

  // ✅ Injects preload link into <head> so browser fetches LCP image immediately
  useEffect(() => {
    if (!firstImage) return
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = firstImage
    link.setAttribute('fetchpriority', 'high')
    document.head.appendChild(link)
    return () => {
      document.head.removeChild(link)
    }
  }, [firstImage])

  useEffect(() => {
    // May 13, 2026 REASON: Fetch active sale once on mount — 60s module-level cache in lib/activeSale
    fetchActiveSale().then(setActiveSale).catch(() => setActiveSale(null))

    // May 13, 2026 REASON: onAuthStateChange — never getSession on mount (rule #10)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null

        if (!user) {
          // May 14, 2026 REASON: Explicit reset — never rely on initial state across auth events
          setIsMember(false)
          return
        }

        // May 14, 2026 FIX: maybeSingle() returns null on no row — .single() threw PGRST116
        // silently leaving isMember true for non-members
        const { data, error } = await supabase
          .from('memberships')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        setIsMember(!error && !!data)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  const handleSubscribe = async () => {
    if (!email.trim()) {
      toast.error('Please enter your email address')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address')
      return
    }
    setSubscribing(true)
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        toast.success('You are subscribed! Welcome to The Real Medico family.')
        setEmail('')
      } else {
        const data = await res.json()
        if (data.error?.includes('duplicate') || res.status === 409) {
          toast.error('This email is already subscribed!')
        } else {
          toast.error('Something went wrong. Please try again.')
        }
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    }
    setSubscribing(false)
  }

  return (
    <div>
      <section className="bg-gradient-to-br from-primary to-primary-dark text-white py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-heading font-black mb-6 leading-tight">
            Wear Your Passion<br />for Medicine
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-blue-100 max-w-2xl mx-auto">
            Premium merchandise for healthcare heroes. Designed with pride, built for comfort.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/shop" className="bg-white text-primary px-8 py-4 rounded-xl font-bold text-lg hover:bg-accent transition-all">
              Shop Now
            </Link>
            <Link href="/about" className="border-2 border-white text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white hover:text-primary transition-all">
              Our Story
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 bg-accent px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-heading font-bold text-center text-primary mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Browse', desc: 'Explore our medical-themed collection designed for healthcare professionals.' },
              { step: '02', title: 'Order', desc: 'Choose your size, color and quantity. Secure checkout in seconds.' },
              { step: '03', title: 'Delivered', desc: 'Your order is printed and shipped directly to your door.' },
            ].map(item => (
              <div key={item.step} className="text-center p-6 bg-white rounded-2xl shadow-sm">
                <div className="text-5xl font-black text-primary mb-4">{item.step}</div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-text-slate">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-heading font-bold text-center text-primary mb-4">
            Featured Products
          </h2>
          <p className="text-center text-text-slate mb-12">
            Bestsellers loved by healthcare professionals
          </p>
          {featuredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* May 13, 2026 REASON: activeSale + isMember passed as props — fetched once above */}
              {featuredProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isFirstCard={index < 2}
                  activeSale={activeSale}
                  isMember={isMember}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="w-full h-56 bg-slate-200 rounded-t-2xl" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-8 bg-slate-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="text-center mt-10">
            <Link href="/shop" className="btn-primary inline-block">
              View All Products
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 bg-primary text-white px-4">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl font-heading font-bold mb-4">
            Stay in the Loop
          </h2>
          <p className="text-blue-100 mb-8">
            Exclusive offers for healthcare workers.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
              className="flex-1 px-4 py-3 rounded-lg text-text-dark focus:outline-none"
            />
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="bg-white text-primary px-6 py-3 rounded-lg font-bold hover:bg-accent transition-all disabled:opacity-70"
            >
              {subscribing ? 'Subscribing...' : 'Subscribe'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
