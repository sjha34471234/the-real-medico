// ============================================================
// FILE: lib/hmac.ts
// PURPOSE: HMAC token signing and verification for Razorpay order validation
// LAST CHANGED: May 16, 2026
// WHY IT EXISTS: signToken() and verifyAndDecodeToken() were duplicated/inlined
//   in both validate-discount/route.ts and create-order/route.ts. Any change
//   to the signing algorithm had to be made in two places — guaranteed to drift.
//   Extracted here so both routes import from one source of truth.
// USED BY:
//   - app/api/razorpay/validate-discount/route.ts (signToken)
//   - app/api/razorpay/create-order/route.ts (verifyAndDecodeToken)
// ⚠️ DO NOT CHANGE: Token format is `base64url(payload).hmac_hex` — both routes
//   depend on this exact format. Changing it invalidates all in-flight tokens.
// ⚠️ DO NOT CHANGE: Timing-safe comparison in verifyAndDecodeToken — prevents
//   timing oracle attacks on HMAC verification. Never swap for === comparison.
// ⚠️ DO NOT CHANGE: Uses ADMIN_JWT_SECRET env var — must match across all routes.
//   If secret changes, all existing signed tokens become invalid immediately.
// ⚠️ DO NOT CHANGE: No React, no Next.js, no fetch() — pure Node.js crypto only.
//   This file must stay importable in both server route files and any future lib/.
// ============================================================

// --- CHANGE LOG ---
// [May 16, 2026] CREATED: Extracted from validate-discount/route.ts + create-order/route.ts
// REASON: Modular architecture mandate — shared logic belongs in lib/, never duplicated.
//   validate-discount had signToken() inline. create-order had verifyAndDecodeToken() inline.
//   Same algorithm, two copies, guaranteed to drift on next edit.
// --- END CHANGE LOG ---

import { createHmac } from 'crypto'

// [May 16, 2026] REASON: 5 minutes is the replay-attack window for validation tokens.
//   Short enough to prevent replay, long enough for a real checkout to complete.
//   Enforced in create-order/route.ts — not here, since this lib has no awareness of
//   what the token is used for. The caller checks expiry against payload.expiresAt.
export const TOKEN_TTL_MS = 5 * 60 * 1000

/**
 * Signs a payload object and returns a token string.
 * Format: `base64url(JSON.stringify(payload)).hmac_sha256_hex`
 *
 * Used by: validate-discount/route.ts
 *
 * @param payload - Any serialisable object. Include `expiresAt: Date.now() + TOKEN_TTL_MS`
 *   in the payload before calling — this function does NOT add expiry automatically.
 */
export function signToken(payload: object): string {
  // [May 16, 2026] REASON: base64url encoding — URL-safe, no padding chars that
  //   could cause issues when token is passed in JSON body
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', process.env.ADMIN_JWT_SECRET!)
    .update(data)
    .digest('hex')
  return `${data}.${sig}`
}

/**
 * Verifies a token's HMAC signature and decodes the payload.
 * Returns the decoded payload object if valid, or null if invalid/tampered.
 *
 * Used by: create-order/route.ts
 *
 * Does NOT check expiry — the caller is responsible for checking payload.expiresAt.
 * This keeps the function pure and reusable for tokens with different TTLs.
 */
export function verifyAndDecodeToken(token: string): Record<string, any> | null {
  const parts = token.split('.')
  // [May 16, 2026] REASON: Exactly 2 parts — data and sig. More or fewer = malformed.
  if (parts.length !== 2) return null

  const [data, receivedSig] = parts

  const expectedSig = createHmac('sha256', process.env.ADMIN_JWT_SECRET!)
    .update(data)
    .digest('hex')

  // [May 16, 2026] REASON: CRITICAL — timing-safe comparison.
  //   A naive `receivedSig !== expectedSig` leaks timing info: an attacker can
  //   measure how many characters matched before the comparison short-circuited,
  //   and use that to brute-force the signature one character at a time.
  //   This loop always runs to completion regardless of where the mismatch is.
  if (receivedSig.length !== expectedSig.length) return null
  let diff = 0
  for (let i = 0; i < expectedSig.length; i++) {
    diff |= receivedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i)
  }
  if (diff !== 0) return null

  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
  } catch {
    // [May 16, 2026] REASON: Malformed base64url or non-JSON payload — treat as invalid
    return null
  }
}
