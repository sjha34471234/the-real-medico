// ============================================================
// FILE: lib/activeSale.ts
// PURPOSE: Fetch the active sale and check if a given product
//   is covered by it (scope: all / specific / category)
// LAST CHANGED: May 14, 2026
// WHY IT EXISTS: Multiple components (Navbar, Homepage, Shop,
//   Product, Cart) all need the same sale + scope-check logic.
//   Centralising here prevents drift between components.
// DEPENDENCIES: /api/sales/active route
// ⚠️ DO NOT CHANGE: getDiscountedPrice handles member vs sale
//   priority — sale wins if higher, member 15% wins if higher.
//   Do not hardcode 0.15 anywhere else.
// ⚠️ DO NOT CHANGE: fetch uses cache:'no-store' — CDN was caching
//   null responses and serving them after a sale was created.
//   s-maxage CDN cache removed from the API route for same reason.
// ============================================================

// --- CHANGE LOG ---
// [May 12, 2026] CREATED: Shared sale helper (Phase 8)
// REASON: All public components need scope-check + price calc
//
// [May 14, 2026] FIXED: Sale active in DB but /api/sales/active returned null
// ROOT CAUSE: Vercel CDN was caching the empty { sale: null } response
//   (Cache-Control: s-maxage=60) from before the sale was created.
//   All client fetches were hitting the CDN cached null for up to 60s+.
// FIX 1: fetchActiveSale now uses cache:'no-store' — bypasses CDN/browser cache
// FIX 2: Module-level TTL cache reduced to 30s (was 60s) — matches real use
// FIX 3: API route (app/api/sales/active/route.ts) Cache-Control removed
// --- END CHANGE LOG ---

export interface ActiveSale {
  id: string
  name: string
  color: string
  discount_percent: number
  scope: 'all' | 'specific' | 'category'
  product_ids: string[]
  category: string | null
  start_date: string
  end_date: string
  status: string
}

// [May 14, 2026] REASON: Module-level cache still used to prevent
// re-fetching on every component render within the same page load.
// TTL reduced to 30s — short enough to pick up new sales quickly.
let _cache: { sale: ActiveSale | null; fetchedAt: number } | null = null
const CACHE_TTL_MS = 30_000

export async function fetchActiveSale(): Promise<ActiveSale | null> {
  const now = Date.now()
  if (_cache && now - _cache.fetchedAt < CACHE_TTL_MS) {
    return _cache.sale
  }
  try {
    // [May 14, 2026] FIX: cache:'no-store' bypasses Vercel CDN and browser cache.
    // Previously the CDN cached { sale: null } and served it even after a sale was created.
    const res = await fetch(
      `${window.location.origin}/api/sales/active`,
      { cache: 'no-store' }
    )
    if (!res.ok) return null
    const json = await res.json()
    _cache = { sale: json.sale ?? null, fetchedAt: now }
    return _cache.sale
  } catch {
    return null
  }
}

// [May 12, 2026] REASON: Check if a specific product (by Printify id + category)
// is covered by the active sale based on its scope setting
export function isProductInSale(
  sale: ActiveSale,
  productId: string,
  productCategory?: string
): boolean {
  if (sale.scope === 'all') return true
  if (sale.scope === 'specific') {
    return sale.product_ids.includes(productId)
  }
  if (sale.scope === 'category') {
    return !!productCategory && sale.category === productCategory
  }
  return false
}

// [May 12, 2026] REASON: Highest-wins rule for member vs sale discount.
// isMember: whether the logged-in user has active Real Medico+ membership.
// Returns the effective discount percent (0 if neither applies).
export function getEffectiveDiscount(
  sale: ActiveSale | null,
  isMember: boolean,
  productId: string,
  productCategory?: string
): number {
  const saleDiscount =
    sale && isProductInSale(sale, productId, productCategory)
      ? sale.discount_percent
      : 0
  // [May 12, 2026] REASON: Member discount is always 15%
  const memberDiscount = isMember ? 15 : 0
  return Math.max(saleDiscount, memberDiscount)
}

// [May 12, 2026] REASON: Apply effective discount to a USD base price
export function getDiscountedPrice(
  basePriceUsd: number,
  discountPercent: number
): number {
  if (discountPercent <= 0) return basePriceUsd
  return basePriceUsd * (1 - discountPercent / 100)
}

// [May 12, 2026] REASON: Format countdown from end_date ISO string
// Returns { days, hours, minutes, seconds, expired }
export function getCountdownParts(endDate: string): {
  days: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
} {
  const diff = new Date(endDate).getTime() - Date.now()
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
  }
  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return { days, hours, minutes, seconds, expired: false }
}
