// ============================================================
// FILE: app/page.tsx
// PURPOSE: Homepage — fetches featured products + active sale server-side
// LAST CHANGED: May 12, 2026
// WHY IT EXISTS: Main store landing page
// DEPENDENCIES: HomeClient, SaleCountdown, Printify API, /api/sales/active
// ⚠️ DO NOT CHANGE: revalidate: 3600 on fetch — ISR caching
// ⚠️ DO NOT CHANGE: getActiveSale uses NEXT_PUBLIC_SITE_URL — required for server fetch
// ============================================================

// --- CHANGE LOG ---
// [May 12, 2026] ADDED: getActiveSale() + SaleCountdown banner (Phase 8)
// REASON: Homepage must show active sale countdown above featured products
// --- END CHANGE LOG ---

import HomeClient from '@/components/HomeClient'
import SaleCountdown from '@/components/SaleCountdown'
import { ActiveSale } from '@/lib/activeSale'

async function getFeaturedProducts() {
  try {
    const response = await fetch(
      `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/products.json?limit=4`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}`,
        },
        next: { revalidate: 3600 },
      }
    )
    if (!response.ok) throw new Error('Printify failed')
    const data = await response.json()
    return data.data.slice(0, 4).map((p: any) => ({
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
    return []
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
  title: 'The Real Medico — Premium Medical Merchandise',
  description: 'Premium merchandise for healthcare heroes. T-shirts, hoodies, mugs and more designed for medical professionals.',
  openGraph: {
    title: 'The Real Medico',
    description: 'Premium merchandise for healthcare heroes.',
    type: 'website',
    url: 'https://therealmedico.store',
  },
}

export default async function HomePage() {
  const featuredProducts = await getFeaturedProducts()
  const firstImage = featuredProducts?.[0]?.image ?? null
  const sale = await getActiveSale()

  return (
    <>
      {/* [May 12, 2026] REASON: Show sale countdown above featured products when a sale is active */}
      {sale && (
        <div className="max-w-6xl mx-auto px-4 pt-8">
          <SaleCountdown sale={sale} variant="full" className="mb-2" />
        </div>
      )}
      <HomeClient
        featuredProducts={featuredProducts}
        firstImage={firstImage}
      />
    </>
  )
}
