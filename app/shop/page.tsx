// ============================================================
// FILE: app/shop/page.tsx
// PURPOSE: Shop listing page — fetches all products + active sale server-side
// LAST CHANGED: May 12, 2026
// WHY IT EXISTS: Main product catalogue page
// DEPENDENCIES: ShopClient, SaleCountdown, Printify API, /api/sales/active
// ⚠️ DO NOT CHANGE: revalidate: 3600 on fetch — ISR caching
// ⚠️ DO NOT CHANGE: getActiveSale uses NEXT_PUBLIC_SITE_URL — required for server fetch
// ============================================================

// --- CHANGE LOG ---
// [May 12, 2026] ADDED: getActiveSale() + SaleCountdown banner (Phase 8)
// REASON: Shop page must show active sale countdown above product grid
// --- END CHANGE LOG ---

import { Suspense } from 'react'
import ShopClient from '@/components/ShopClient'
import SaleCountdown from '@/components/SaleCountdown'
import { ActiveSale } from '@/lib/activeSale'

async function getProducts() {
  try {
    const response = await fetch(
      `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/products.json?limit=20`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}`,
        },
        next: { revalidate: 3600 },
      }
    )
    if (!response.ok) throw new Error('Printify failed')
    const data = await response.json()
    return data.data.map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.variants[0]?.price / 100 || 0,
      image: p.images[0]?.src || 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Product',
      images: p.images.map((img: any) => img.src),
      category: p.tags?.[0]?.toLowerCase() || 'general',
      variants: p.variants.map((v: any) => ({
        id: v.id,
        title: v.title,
        price: v.price / 100,
        available: v.is_available,
      })),
    }))
  } catch {
    return [
      { id: 'f1', title: 'Medical Heartbeat Tee', price: 29.99, image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Medical+Tee', images: [], category: 'tshirts', description: 'Classic medical design', variants: [{ id: 'M', title: 'M', price: 29.99, available: true }] },
      { id: 'f2', title: 'Doctor Life Hoodie', price: 49.99, image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Doctor+Hoodie', images: [], category: 'hoodies', description: 'Cozy hoodie', variants: [{ id: 'M', title: 'M', price: 49.99, available: true }] },
      { id: 'f3', title: 'Stethoscope Mug', price: 19.99, image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Medico+Mug', images: [], category: 'mugs', description: 'Start your shift right', variants: [{ id: 'OS', title: 'One Size', price: 19.99, available: true }] },
      { id: 'f4', title: 'Nurse Pride Tee', price: 27.99, image: 'https://via.placeholder.com/400x400/1A3A8F/ffffff?text=Nurse+Tee', images: [], category: 'tshirts', description: 'For heroes in scrubs', variants: [{ id: 'M', title: 'M', price: 27.99, available: true }] },
    ]
  }
}

// [May 12, 2026] REASON: Fetch active sale server-side so countdown renders on first load.
// revalidate: 60 — sale status can change, refresh every minute is sufficient.
async function getActiveSale(): Promise<ActiveSale | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL}/api/sales/active`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) return null
    const json = await res.json()
    return json.sale ?? null
  } catch {
    return null
  }
}

export const metadata = {
  title: 'Shop — The Real Medico',
  description: 'Browse premium medical merchandise for healthcare professionals.',
}

export default async function ShopPage() {
  const products = await getProducts()
  const sale = await getActiveSale()

  return (
    <Suspense fallback={
      <div className="max-w-6xl mx-auto px-4 py-12 animate-pulse">
        <div className="h-10 bg-slate-200 rounded w-1/4 mb-8" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card">
              <div className="w-full h-56 bg-slate-200 rounded-t-2xl" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-8 bg-slate-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    }>
      {/* [May 12, 2026] REASON: Countdown above product grid when sale is active */}
      {sale && (
        <div className="max-w-6xl mx-auto px-4 pt-8">
          <SaleCountdown sale={sale} variant="full" className="mb-2" />
        </div>
      )}
      <ShopClient products={products} />
    </Suspense>
  )
}
