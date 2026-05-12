// ============================================================
// FILE: app/shop/[id]/page.tsx
// PURPOSE: Server component for individual product detail pages
// LAST CHANGED: May 12, 2026
// WHY IT EXISTS: Fetches product from Printify API server-side, passes to ProductDetailClient
// DEPENDENCIES: Printify API, ProductDetailClient, SaleCountdown, /api/sales/active
// ⚠️ DO NOT CHANGE:
//   - revalidate: 3600 on fetch — ISR caching, prevents cold API call on every visit
//   - export const revalidate = 3600 — page-level ISR, NOT force-dynamic
//   - params is { params: { id: string } } NOT Promise — Next.js 14 syntax
//   - LCP preload link — must stay, eliminates image discovery delay
//   - getActiveSale uses NEXT_PUBLIC_SITE_URL — required for server-side fetch
// ============================================================

// --- CHANGE LOG ---
// [May 11, 2026] CHANGED: Removed force-dynamic + revalidate=0, restored ISR
// REASON: force-dynamic was hitting Printify API cold on every single page visit
//
// [May 11, 2026] CHANGED: Fixed params type — was Promise<{id}>, now {id: string} (Next.js 14)
//
// [May 11, 2026] ADDED: LCP image preload link in page head
// REASON: Browser was discovering product image late (after JS hydration)
//
// [May 12, 2026] ADDED: getActiveSale() + SaleCountdown below price (Phase 8)
// REASON: Product pages must show active sale countdown
// --- END CHANGE LOG ---

import { Suspense } from 'react'
import ProductDetailClient from '@/components/ProductDetailClient'
import SaleCountdown from '@/components/SaleCountdown'
import { ActiveSale } from '@/lib/activeSale'
import { notFound } from 'next/navigation'

// [May 11, 2026] REASON: ISR at 1 hour — product data doesn't change minute-to-minute.
export const revalidate = 3600

async function getProduct(id: string) {
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
    if (!response.ok) throw new Error('Failed')
    const data = await response.json()
    const p = data.data.find((p: any) => p.id === id)
    if (!p) return null
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.variants[0]?.price / 100 || 0,
      image: p.images[0]?.src || '',
      images: p.images.map((img: any) => img.src),
      category: p.tags?.[0]?.toLowerCase() || 'general',
      variants: p.variants.map((v: any) => ({
        id: String(v.id),
        title: v.title,
        price: v.price / 100,
        available: v.is_available,
      })),
    }
  } catch {
    return null
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

// [May 11, 2026] REASON: Next.js 14 params is NOT a Promise — no await needed
export async function generateMetadata({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id)
  if (!product) return { title: 'Product Not Found' }
  return {
    title: `${product.title} — The Real Medico`,
    description: product.description?.replace(/<[^>]*>/g, '').slice(0, 160),
    openGraph: {
      title: product.title,
      images: [product.image],
    },
  }
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id)
  if (!product) notFound()
  const sale = await getActiveSale()

  return (
    <>
      {/*
       * [May 11, 2026] LCP IMAGE PRELOAD
       * WHY: The main product image is the LCP element on this page.
       * ⚠️ DO NOT REMOVE — this is the primary LCP fix for product pages
       * ⚠️ DO NOT change imageSizes without also updating ProductDetailClient sizes prop
       */}
      <head>
        <link
          rel="preload"
          as="image"
          href={product!.image}
          imageSizes="(max-width: 768px) 100vw, 50vw"
        />
      </head>

      {/* [May 12, 2026] REASON: Sale countdown above product detail when sale is active */}
      {sale && (
        <div className="max-w-6xl mx-auto px-4 pt-6">
          <SaleCountdown sale={sale} variant="full" className="mb-2" />
        </div>
      )}

      <Suspense fallback={
        <div className="max-w-6xl mx-auto px-4 py-12 animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="w-full h-96 bg-slate-200 rounded-2xl" />
            <div className="space-y-4">
              <div className="h-8 bg-slate-200 rounded w-3/4" />
              <div className="h-6 bg-slate-200 rounded w-1/4" />
              <div className="h-24 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      }>
        <ProductDetailClient product={product!} />
      </Suspense>
    </>
  )
}
