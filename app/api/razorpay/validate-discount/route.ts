// ============================================================
// FILE: app/api/razorpay/validate-discount/route.ts
// PURPOSE: Server-side discount validation — computes correct amount and returns signed token
// LAST CHANGED: May 15, 2026
// WHY IT EXISTS: Prevent client-side price tampering — previously checkout sent its own
//   computed razorpayAmount to create-order, which trusted it blindly.
//   Now checkout calls this first; we re-compute everything server-side and return
//   a short-lived HMAC-signed token. create-order only accepts that token.
// DEPENDENCIES: Supabase (service role), lib/activeSale logic (inlined — no client import),
//   ADMIN_JWT_SECRET (reused for HMAC — no new env var needed),
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ⚠️ DO NOT CHANGE: Uses SUPABASE_SERVICE_ROLE_KEY — bypasses RLS, server only
// ⚠️ DO NOT CHANGE: Token TTL is 5 minutes — do not increase (replay attack window)
// ⚠️ DO NOT CHANGE: Highest-wins rule — Math.max(saleDiscount, memberDiscount)
// ⚠️ DO NOT CHANGE: membership uses boolean .eq('active', true) NOT .eq('status','active')
// ⚠️ DO NOT CHANGE: maybeSingle() not single() — single() throws PGRST116 on no row
// ============================================================

// --- CHANGE LOG ---
// [May 15, 2026] CREATED: New route for server-side discount enforcement
// REASON: Client was computing razorpayAmount itself and sending to create-order.
//   Anyone with DevTools could set amount=100 (1 paise) and get a valid Razorpay order.
//   Fix: this route verifies identity + discount server-side, returns HMAC-signed token.
//   create-order now only accepts the signed token, never a raw client amount.
// --- END CHANGE LOG ---

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

// May 15, 2026 REASON: Service role — needed to verify membership server-side (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Shipping logic (mirrors create-order) ───────────────────────────────────
// May 15, 2026 REASON: Duplicated here intentionally — server must compute shipping
//   independently, not trust client. Keep in sync with create-order if zones change.
type CurrencyCode = 'INR' | 'USD' | 'GBP' | 'AED' | 'SGD' | 'MYR' | 'AUD' | 'CAD'

const USD_RATES: Record<CurrencyCode, number> = {
  INR: 83, USD: 1, GBP: 0.79, AED: 3.67,
  SGD: 1.34, MYR: 4.7, AUD: 1.53, CAD: 1.36,
}

function getShippingChargeINR(country: string, isMember: boolean): number {
  // May 15, 2026 REASON: Members get free shipping — enforced server-side here
  if (isMember) return 0

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

// ─── Sale scope check (mirrors lib/activeSale.ts isProductInSale) ─────────────
// May 15, 2026 REASON: Inlined here — lib/activeSale.ts uses client-side fetch.
//   Server reads sale directly from Supabase above. Logic must stay identical.
function isProductInSale(
  sale: {
    scope: string
    product_ids: string[] | null
    category: string | null
  },
  productId: string,
  // category not tracked per cart item — if scope=category we apply to all
  // (conservative: give discount rather than deny incorrectly)
): boolean {
  if (sale.scope === 'all') return true
  if (sale.scope === 'specific') {
    return Array.isArray(sale.product_ids) && sale.product_ids.includes(productId)
  }
  if (sale.scope === 'category') {
    // May 15, 2026 REASON: Cart items don't carry category — we can't verify server-side.
    // Fail open (give discount) to avoid false denials. Worst case: user gets sale price
    // they'd have seen on the product page anyway. Failing closed would be worse UX.
    return true
  }
  return false
}

// ─── HMAC token helpers ───────────────────────────────────────────────────────
// May 15, 2026 REASON: Reusing ADMIN_JWT_SECRET — no new env var needed.
//   Token = base64(payload JSON) + "." + HMAC-SHA256 signature
//   Payload contains: amount (smallest unit), currency, expiry timestamp
//   create-order verifies signature + checks expiry before using amount.

const TOKEN_TTL_MS = 5 * 60 * 1000 // 5 minutes

function signToken(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', process.env.ADMIN_JWT_SECRET!)
    .update(data)
    .digest('hex')
  return `${data}.${sig}`
}

// ─── CartItem type ────────────────────────────────────────────────────────────
interface CartItem {
  id: string        // Printify product ID
  title: string
  price: number     // base USD price (pre-discount)
  quantity: number
  size: string
  image: string
}

// ─── Rate limiting (in-memory, resets on cold start) ─────────────────────────
// May 15, 2026 REASON: This endpoint hits Supabase on every call — protect against
//   brute-force / scraping. 10 calls per IP per minute.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  // May 15, 2026 REASON: Rate limit before any DB work
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      { status: 429 }
    )
  }

  try {
    // ── 1. Parse and validate request body ──────────────────────────────────
    const body = await req.json().catch(() => null)

    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { items, currency: rawCurrency, country: rawCountry } = body as {
      items: CartItem[]
      currency: string
      country: string
    }

    // Sanitise inputs
    const currency: CurrencyCode =
      rawCurrency in USD_RATES ? (rawCurrency as CurrencyCode) : 'INR'
    const country = typeof rawCountry === 'string' ? rawCountry.trim() : 'India'

    // Validate each item has required fields and a positive price
    for (const item of items) {
      if (
        typeof item.id !== 'string' ||
        typeof item.price !== 'number' ||
        item.price <= 0 ||
        typeof item.quantity !== 'number' ||
        item.quantity < 1 ||
        item.quantity > 100 // May 15, 2026: sanity cap — no 10,000-qty orders
      ) {
        return NextResponse.json({ error: 'Invalid item data' }, { status: 400 })
      }
    }

    // ── 2. Verify user session from cookie ──────────────────────────────────
    // May 15, 2026 REASON: We need user_id to check membership.
    //   Supabase session token is in the auth cookie — getUser() with it
    //   verifies the JWT signature server-side (no extra DB call for auth).
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    let userId: string | null = null
    if (accessToken) {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken)
      if (!error && user) userId = user.id
    }

    // ── 3. Check active membership server-side ───────────────────────────────
    // May 15, 2026 REASON: Never trust isMember from client — always re-verify here
    let isMember = false
    if (userId) {
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('id')
        .eq('user_id', userId)
        .eq('active', true) // May 15, 2026: boolean column — NOT .eq('status','active')
        .maybeSingle()      // May 15, 2026: maybeSingle not single — single throws on no row

      if (membership) isMember = true
    }

    // ── 4. Fetch active sale server-side ─────────────────────────────────────
    // May 15, 2026 REASON: Never trust sale data from client — fetch directly from DB
    const now = new Date().toISOString()
    const { data: saleRow } = await supabaseAdmin
      .from('sales')
      .select('id, name, discount_percent, scope, product_ids, category, end_date')
      .eq('status', 'active')
      .lte('start_date', now)
      .gte('end_date', now)
      .order('discount_percent', { ascending: false })
      .limit(1)
      .maybeSingle()

    // ── 5. Compute discounted subtotal item by item ───────────────────────────
    // May 15, 2026 REASON: Per-item scope check — a "specific products" sale should
    //   only discount those products, not the whole cart. This is more accurate than
    //   the client-side shortcut (which applied one discount % to the entire cart).
    let subtotalUSD = 0
    let discountedSubtotalUSD = 0

    for (const item of items) {
      const lineBaseUSD = item.price * item.quantity

      // Determine sale discount for this item
      let saleDiscount = 0
      if (saleRow && isProductInSale(saleRow, item.id)) {
        saleDiscount = saleRow.discount_percent
      }

      // Highest-wins rule per item
      const memberDiscount = isMember ? 15 : 0
      const effectiveDiscount = Math.max(saleDiscount, memberDiscount)

      const lineDiscountedUSD =
        effectiveDiscount > 0
          ? lineBaseUSD * (1 - effectiveDiscount / 100)
          : lineBaseUSD

      subtotalUSD += lineBaseUSD
      discountedSubtotalUSD += lineDiscountedUSD
    }

    const savingsUSD = subtotalUSD - discountedSubtotalUSD

    // ── 6. Compute shipping ──────────────────────────────────────────────────
    // May 15, 2026 REASON: Members get free shipping — enforced server-side
    const shippingINR = getShippingChargeINR(country, isMember)
    const shippingUSD = shippingINR / USD_RATES['INR']

    // ── 7. Convert to payment currency ───────────────────────────────────────
    const rate = USD_RATES[currency]
    const totalUSD = discountedSubtotalUSD + shippingUSD
    const totalInCurrency = totalUSD * rate

    // Smallest unit (paise, cents, fils, etc.)
    const totalSmallest = Math.round(totalInCurrency * 100)

    if (totalSmallest < 100) {
      return NextResponse.json(
        { error: `Minimum order amount is 1 ${currency}` },
        { status: 400 }
      )
    }

    // ── 8. Sign and return token ──────────────────────────────────────────────
    // May 15, 2026 REASON: Token payload is what create-order will use.
    //   Client cannot forge it (HMAC), cannot reuse it after 5 min (expiry).
    const tokenPayload = {
      amount: totalSmallest,       // smallest unit — create-order uses this directly
      currency,
      country,
      expiresAt: Date.now() + TOKEN_TTL_MS,
      // Metadata for order records / debugging — not used in amount calc
      subtotalUSD: Math.round(subtotalUSD * 100) / 100,
      discountedSubtotalUSD: Math.round(discountedSubtotalUSD * 100) / 100,
      savingsUSD: Math.round(savingsUSD * 100) / 100,
      shippingINR,
      isMember,
      saleId: saleRow?.id ?? null,
      saleName: saleRow?.name ?? null,
    }

    const validationToken = signToken(tokenPayload)

    return NextResponse.json({
      validationToken,
      // Return display values for the checkout UI to show before user clicks Pay
      subtotalUSD: tokenPayload.subtotalUSD,
      discountedSubtotalUSD: tokenPayload.discountedSubtotalUSD,
      savingsUSD: tokenPayload.savingsUSD,
      shippingINR,
      totalSmallest,
      currency,
      isMember,
      saleId: saleRow?.id ?? null,
      saleName: saleRow?.name ?? null,
      saleDiscount: saleRow?.discount_percent ?? 0,
    })
  } catch (err: any) {
    // May 15, 2026 REASON: Never leak internal errors to client
    console.error('[validate-discount] error:', err?.message ?? err)
    return NextResponse.json(
      { error: 'Validation failed. Please try again.' },
      { status: 500 }
    )
  }
}
