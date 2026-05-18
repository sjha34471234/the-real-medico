// ============================================================
// FILE: lib/shipping.ts
// PURPOSE: Shipping charge calculation by country and membership status
// LAST CHANGED: May 16, 2026
// WHY IT EXISTS: getShippingChargeINR() was inlined inside validate-discount/route.ts.
//   Shipping zone definitions are business-critical — if they need updating (new zones,
//   price changes) there must be exactly ONE place to edit. Any future route that needs
//   shipping (e.g. a COD route, an order estimate endpoint) imports from here.
// USED BY:
//   - app/api/razorpay/validate-discount/route.ts
//   - Any future route that needs shipping cost calculation
// ⚠️ DO NOT CHANGE: Zone definitions must stay in sync with the shipping page
//   (app/shipping/page.tsx) and the brain dump shipping table. If you change a zone
//   here, update both of those too or customers will see incorrect displayed prices.
// ⚠️ DO NOT CHANGE: Members always return 0 — free shipping is a core membership
//   benefit enforced server-side. Never add a condition that charges members.
// ⚠️ DO NOT CHANGE: Returns INR always. Callers convert to target currency using
//   peak_rate from Supabase. Never return USD or any other currency from this function.
// ⚠️ DO NOT CHANGE: No React, no Next.js, no fetch() — pure TypeScript only.
// ============================================================

// --- CHANGE LOG ---
// [May 16, 2026] CREATED: Extracted from validate-discount/route.ts
// REASON: Modular architecture mandate — shipping zone logic is business-critical
//   and must live in exactly one place. Was inlined in validate-discount (~40 lines).
//   Any future route needing shipping would have had to copy-paste it.
// --- END CHANGE LOG ---

// [May 16, 2026] REASON: Shipping zones defined as typed arrays — easy to add
//   new countries without touching any logic. Just append to the right zone array.
const ZONE_SAARC = ['nepal', 'bangladesh', 'sri lanka', 'bhutan', 'myanmar']

const ZONE_GULF_SEA = [
  'uae', 'singapore', 'malaysia', 'thailand', 'indonesia',
  'philippines', 'vietnam', 'qatar', 'kuwait', 'bahrain',
  'oman', 'saudi arabia',
]

const ZONE_WESTERN = [
  'united states', 'usa', 'us', 'united kingdom', 'uk', 'canada',
  'australia', 'germany', 'france', 'netherlands', 'italy', 'spain',
  'sweden', 'norway', 'denmark', 'finland', 'switzerland', 'austria',
  'belgium', 'new zealand', 'ireland', 'portugal',
]

const ZONE_AFRICA_LATAM = [
  'south africa', 'nigeria', 'kenya', 'ghana',
  'brazil', 'argentina', 'mexico', 'colombia',
]

// [May 16, 2026] REASON: Shipping charge table (INR) — matches brain dump + shipping page
// India: FREE | SAARC: ₹299 | Gulf/SEA: ₹599 | Western: ₹899 | Africa/LatAm: ₹1099 | Rest: ₹999
const CHARGES = {
  india: 0,
  saarc: 299,
  gulfSea: 599,
  western: 899,
  africaLatam: 1099,
  rest: 999,
} as const

/**
 * Returns the shipping charge in INR for a given country and membership status.
 *
 * Always returns 0 for members (free shipping benefit).
 * Always returns 0 for India.
 * Returns INR — callers must convert to target currency using peak_rate from Supabase.
 *
 * @param country - Country name string from the checkout form (case-insensitive)
 * @param isMember - Whether the user has an active Real Medico+ membership
 * @returns Shipping charge in INR (integer)
 */
export function getShippingChargeINR(country: string, isMember: boolean): number {
  // [May 16, 2026] REASON: Members always free — core membership benefit, enforced server-side
  if (isMember) return 0

  const c = country?.toLowerCase().trim()

  // [May 16, 2026] REASON: Empty string or 'india' both mean domestic — free shipping
  if (!c || c === 'india') return CHARGES.india

  if (ZONE_SAARC.includes(c))       return CHARGES.saarc
  if (ZONE_GULF_SEA.includes(c))    return CHARGES.gulfSea
  if (ZONE_WESTERN.includes(c))     return CHARGES.western
  if (ZONE_AFRICA_LATAM.includes(c)) return CHARGES.africaLatam

  // [May 16, 2026] REASON: Catch-all for any country not in a named zone
  return CHARGES.rest
}

/**
 * Returns true if shipping is free for this country + membership combo.
 * Convenience helper — avoids callers needing to check === 0.
 */
export function isShippingFree(country: string, isMember: boolean): boolean {
  return getShippingChargeINR(country, isMember) === 0
}

/**
 * Returns the display label for a shipping zone.
 * Used by the shipping page and any future shipping breakdown UI.
 */
export function getShippingZoneLabel(country: string): string {
  const c = country?.toLowerCase().trim()
  if (!c || c === 'india')           return 'India (Free)'
  if (ZONE_SAARC.includes(c))       return 'South Asia (₹299)'
  if (ZONE_GULF_SEA.includes(c))    return 'Gulf & Southeast Asia (₹599)'
  if (ZONE_WESTERN.includes(c))     return 'USA, UK, Europe & Oceania (₹899)'
  if (ZONE_AFRICA_LATAM.includes(c)) return 'Africa & Latin America (₹1099)'
  return 'Rest of World (₹999)'
}
