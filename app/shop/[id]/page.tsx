// ============================================================
// FILE: app/shop/[id]/page.tsx
// PURPOSE: Server component for individual product detail pages
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Fetches product from Printify API server-side, passes to ProductDetailClient
// DEPENDENCIES: Printify API, ProductDetailClient, currencyStore (client)
// ⚠️ DO NOT CHANGE:
//   - revalidate: 3600 on fetch — ISR caching, prevents cold API call on every visit
//   - export const revalidate = 3600 — page-level ISR, NOT force-dynamic
//   - params is { params: { id: string } } NOT Promise — Next.js 14 syntax
//   - LCP preload link — must stay, eliminates image discovery delay
// ============================================================

// --- CHANGE LOG ---
// [May 11, 2026] CHANGED: Removed force-dynamic + revalidate=0, restored ISR
// REASON: force-dynamic was hitting Printify API cold on every single page visit
// WHAT BROKE BEFORE: Every product page load = fresh API call = added latency to LCP
// OLD CODE WAS: export const dynamic = 'force-dynamic' / export const revalidate = 0
//
// [May 11, 2026] CHANGED: Fixed params type — was Promise<{id}>, now {id: string} (Next.js 14)
// REASON: Promise<params> is Next.js 15 syntax. Project is on Next.js 14.2.29.
// WHAT BROKE BEFORE: May have caused silent param resolution issues
//
// [May 11, 2026] ADDED: LCP image preload link in page head
// REASON: Browser was discovering product image late (after JS hydration)
// HOW: Server knows the image URL — inject preload link so browser fetches it immediately
// EXPECTED RESULT: LCP should drop significantly on product pages
// --- END CHANGE LOG ---

import { Suspense } from 'react'
import ProductDetailClient from '@/components/ProductDetailClient'
import { notFound } from 'next/navigation'

// [May 11, 2026] REASON: ISR at 1 hour — product data doesn't change minute-to-minute.
// Vercel caches the rendered page for 1 hour, then regenerates on next request.
// This eliminates the cold Printify API call on every visit.
// To force-refresh a product: visit /api/revalidate
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

// [May 11, 2026] REASON: Next.js 14 params is NOT a Promise — no await needed
// Promise<params> syntax is Next.js 15 only — using it in 14 may cause issues
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

  return (
    <>
      {/*
       * [May 11, 2026] LCP IMAGE PRELOAD
       * WHY: The main product image is the LCP element on this page.
       * Without this, browser discovers the image only after:
       *   HTML → JS bundle → React hydration → component render → image src set
       * With this preload in <head>, browser fetches the image immediately
       * on first byte of HTML — in parallel with everything else.
       *
       * imageSizes matches next/image sizes prop in ProductDetailClient:
       *   "(max-width: 768px) 100vw, 50vw"
       * This tells the browser which size to preload for the current viewport.
       *
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

