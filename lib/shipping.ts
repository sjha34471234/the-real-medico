// ============================================================
// FILE: lib/shipping.ts
// PURPOSE: Shipping charge calculation and sale product scope check —
//   pure logic, no UI, no Next.js. Single source of truth for zone logic.
// LAST CHANGED: May 17, 2026
// WHY IT EXISTS: Extracted from app/api/razorpay/validate-discount/route.ts as part
//   of modular architecture refactor (May 16, 2026 mandate).
//   Any future route that needs shipping charges imports from here — never copy the zones.
// DEPENDENCIES: None
// ⚠️ DO NOT CHANGE: Zone definitions must stay in sync with the shipping info page
//   (app/shipping/page.tsx). If you update a zone here, update that page too.
// ⚠️ DO NOT CHANGE: Members always return 0 — server enforces free shipping for members.
//   Never let a caller override this by skipping the isMember check.
// ⚠️ DO NOT CHANGE: isProductInSale scope='category' returns true (fail-open).
//   Cart items have no category — we can't check, so we apply the discount.
// ============================================================

// --- CHANGE LOG ---
// [May 17, 2026] CREATED: Extracted from validate-discount/route.ts
// REASON: Modular architecture mandate — shipping logic was inline in the route.
//   validate-discount now imports from here instead of owning the zone table.
// --- END CHANGE LOG ---

/**
 * Returns the shipping charge in INR for a given country.
 * Members always get free shipping (returns 0).
 * Shipping is defined in INR internally — callers convert to other currencies.
 */
export function getShippingChargeINR(country: string, isMember: boolean): number {
  if (isMember) return 0 // Members always get free shipping

  const c = country?.toLowerCase().trim()
  if (!c || c === 'india') return 0

  const zone1 = ['nepal', 'bangladesh', 'sri lanka', 'bhutan', 'myanmar']
  if (zone1.includes(c)) return 299

  const zone2 = [
    'uae', 'singapore', 'malaysia', 'thailand', 'indonesia',
    'philippines', 'vietnam', 'qatar', 'kuwait', 'bahrain',
    'oman', 'saudi arabia',
  ]
  if (zone2.includes(c)) return 599

  const zone3 = [
    'united states', 'usa', 'us', 'united kingdom', 'uk', 'canada',
    'australia', 'germany', 'france', 'netherlands', 'italy', 'spain',
    'sweden', 'norway', 'denmark', 'finland', 'switzerland', 'austria',
    'belgium', 'new zealand', 'ireland', 'portugal',
  ]
  if (zone3.includes(c)) return 899

  const zone4 = [
    'south africa', 'nigeria', 'kenya', 'ghana',
    'brazil', 'argentina', 'mexico', 'colombia',
  ]
  if (zone4.includes(c)) return 1099

  return 999
}

/**
 * Returns true if a product belongs to the given sale's scope.
 * scope='all'      → always true
 * scope='specific' → true only if productId is in sale.product_ids
 * scope='category' → true (fail-open — cart items carry no category)
 */
export function isProductInSale(
  sale: { scope: string; product_ids: string[] | null; category: string | null },
  productId: string,
): boolean {
  if (sale.scope === 'all') return true
  if (sale.scope === 'specific') {
    return Array.isArray(sale.product_ids) && sale.product_ids.includes(productId)
  }
  if (sale.scope === 'category') return true // Fail open — cart has no category
  return false
}
