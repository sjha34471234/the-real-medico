// ============================================================
// FILE: lib/hmac.ts
// PURPOSE: HMAC token signing and verification — single source of truth.
//   Used by validate-discount (signs) and create-order (verifies).
// LAST CHANGED: May 17, 2026
// WHY IT EXISTS: Extracted from app/api/razorpay/validate-discount/route.ts and
//   app/api/razorpay/create-order/route.ts as part of modular architecture refactor.
//   Both routes previously duplicated this logic — now both import from here.
// DEPENDENCIES: Node.js crypto (built-in), ADMIN_JWT_SECRET env var
// ⚠️ DO NOT CHANGE: Token format is `base64url(payload).hex(hmac)` — two parts, one dot.
//   validate-discount signs, create-order verifies. Both must use the same format.
// ⚠️ DO NOT CHANGE: Timing-safe comparison in verifyAndDecodeToken.
//   Do NOT replace the loop with receivedSig === expectedSig — that leaks timing info.
// ⚠️ DO NOT CHANGE: TOKEN_TTL_MS = 5 minutes. Do not increase — larger window = larger
//   replay attack surface. Expiry is checked by the CALLER (create-order), not here.
// ============================================================

// --- CHANGE LOG ---
// [May 17, 2026] CREATED: Extracted from validate-discount/route.ts + create-order/route.ts
// REASON: Modular architecture mandate — both routes had their own copy of this logic.
//   One change (e.g. key rotation) now only needs to happen in one place.
// --- END CHANGE LOG ---

import { createHmac } from 'crypto'

/** Token TTL in milliseconds. Callers include `expiresAt: Date.now() + TOKEN_TTL_MS` in payload. */
export const TOKEN_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Signs a payload object and returns a token string: `base64url(payload).hex(hmac)`.
 * Uses ADMIN_JWT_SECRET from env — must be set in Vercel env vars.
 */
export function signToken(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', process.env.ADMIN_JWT_SECRET!)
    .update(data)
    .digest('hex')
  return `${data}.${sig}`
}

/**
 * Verifies the HMAC signature of a token and returns the decoded payload,
 * or null if the token is malformed or the signature doesn't match.
 *
 * ⚠️ Does NOT check expiry — caller must check payload.expiresAt after calling this.
 */
export function verifyAndDecodeToken(token: string): Record<string, any> | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [data, receivedSig] = parts

  const expectedSig = createHmac('sha256', process.env.ADMIN_JWT_SECRET!)
    .update(data)
    .digest('hex')

  // May 15, 2026 REASON: Timing-safe comparison — prevents timing oracle attacks.
  // Compare lengths first (fast fail), then constant-time XOR loop.
  if (receivedSig.length !== expectedSig.length) return null
  let diff = 0
  for (let i = 0; i < expectedSig.length; i++) {
    diff |= receivedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i)
  }
  if (diff !== 0) return null

  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}
