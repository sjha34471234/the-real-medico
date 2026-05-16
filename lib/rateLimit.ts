// ============================================================
// FILE: lib/rateLimit.ts
// PURPOSE: Sliding-window in-memory rate limiter for all public API routes
// LAST CHANGED: May 16, 2026
// WHY IT EXISTS: Prevent spam/flooding on newsletter, search/log, Razorpay endpoints
// DEPENDENCIES: None — no external service required
// ⚠️ DO NOT CHANGE: In-memory store resets on Vercel cold starts — this is intentional.
//   Upstash Redis would burn the free tier (10k req/day) at normal traffic levels.
//   This limiter is the last line of defence; real security is HMAC + Bearer auth on payment routes.
// ============================================================

// --- CHANGE LOG ---
// [May 16, 2026] CREATED: Sliding window rate limiter
// REASON: OWASP compliance — all public endpoints need flood protection
// --- END CHANGE LOG ---

type RateLimitEntry = {
  timestamps: number[]  // [May 16, 2026] REASON: sliding window needs full timestamp history
}

// [May 16, 2026] REASON: module-level map persists across requests within same Vercel instance
const store = new Map<string, RateLimitEntry>()

// [May 16, 2026] REASON: clean up old entries every 10 min to prevent memory leak on long-lived instances
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of Array.from(store.entries())) {
    if (entry.timestamps.length === 0 || now - entry.timestamps[entry.timestamps.length - 1] > CLEANUP_INTERVAL_MS) {
      store.delete(key)
    }
  }
}, CLEANUP_INTERVAL_MS)

export type RateLimitConfig = {
  maxRequests: number   // max hits allowed in the window
  windowMs: number      // sliding window size in ms
}

// [May 16, 2026] REASON: pre-defined configs per route type — centralised so limits are easy to audit
export const RATE_LIMITS = {
  newsletter:           { maxRequests: 3,  windowMs: 60 * 60 * 1000 },  // 3/hr per IP
  searchLog:            { maxRequests: 30, windowMs: 60 * 1000 },        // 30/min per IP
  razorpayValidate:     { maxRequests: 10, windowMs: 60 * 1000 },        // 10/min per IP
  razorpayCreateOrder:  { maxRequests: 10, windowMs: 60 * 1000 },        // 10/min per IP
  razorpaySub:          { maxRequests: 5,  windowMs: 60 * 1000 },        // 5/min per IP
  razorpayVerify:       { maxRequests: 5,  windowMs: 60 * 1000 },        // 5/min per IP
  razorpayCancel:       { maxRequests: 5,  windowMs: 60 * 1000 },        // 5/min per IP
  currencySync:         { maxRequests: 5,  windowMs: 60 * 1000 },        // 5/min per IP (server already hour-gates)
} as const

/**
 * Returns true if the request is allowed, false if it should be blocked.
 * Key format: `${routeName}:${ip}` — scoped per route so limits don't bleed across endpoints.
 */
export function checkRateLimit(ip: string, routeName: keyof typeof RATE_LIMITS): boolean {
  const config = RATE_LIMITS[routeName]
  const key = `${routeName}:${ip}`
  const now = Date.now()
  const windowStart = now - config.windowMs

  const entry = store.get(key) ?? { timestamps: [] }

  // [May 16, 2026] REASON: sliding window — drop timestamps outside the current window
  entry.timestamps = entry.timestamps.filter(t => t > windowStart)

  if (entry.timestamps.length >= config.maxRequests) {
    store.set(key, entry)
    return false  // blocked
  }

  entry.timestamps.push(now)
  store.set(key, entry)
  return true  // allowed
}

/**
 * Extracts the real client IP from Vercel/Next.js headers.
 * Falls back to '0.0.0.0' if none found — never throws.
 */
export function getClientIp(request: Request): string {
  // [May 16, 2026] REASON: Vercel sets x-forwarded-for; x-real-ip is Nginx convention — check both
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '0.0.0.0'
  )
}

/**
 * Returns a standard 429 Response with Retry-After header.
 * Import and return this directly from route handlers when blocked.
 */
export function rateLimitResponse(windowMs: number): Response {
  const retryAfterSeconds = Math.ceil(windowMs / 1000)
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    }
  )
}
