// ============================================================
// FILE: app/api/newsletter/route.ts
// PURPOSE: Newsletter subscription — validates email, inserts into Supabase
// LAST CHANGED: May 16, 2026
// WHY IT EXISTS: Lets visitors subscribe to the newsletter from the footer form
// DEPENDENCIES: lib/rateLimit.ts, Supabase (service role), newsletter_subscribers table
// ⚠️ DO NOT CHANGE: Uses createClient directly — NOT imported from @/lib/supabase
//   (server route rule: always create a fresh admin client in the route file)
// ⚠️ DO NOT CHANGE: Returns success:true even on duplicate email (23505) —
//   avoids leaking whether an email is already subscribed (enumeration attack)
// ⚠️ DO NOT CHANGE: Rate limit is 3/hr per IP — newsletter spam is costly and
//   hard to undo. 3 is generous for real users, brutal for bots.
// ============================================================

// --- CHANGE LOG ---
// [May 16, 2026] HARDENED: Added rate limiting, email validation, sanitization, honeypot
// REASON: Original route had no protection — open to spam flooding and injection.
//   - No rate limit → bot could fill DB with garbage in seconds
//   - No email validation → any string was accepted and inserted
//   - supabaseAdmin imported from @/lib/supabase → wrong pattern for route files
//   - No honeypot → bots fill the form trivially
// --- END CHANGE LOG ---

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit'

// [May 16, 2026] REASON: Service role for server-side insert — bypasses RLS safely
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// [May 16, 2026] REASON: RFC 5322-inspired regex — rejects obvious garbage while
//   allowing all real email formats. Not perfect (no regex is) but catches 99% of bots.
const EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/

export async function POST(req: Request) {
  // ── 1. Rate limit ────────────────────────────────────────────────────────────
  // [May 16, 2026] REASON: 3 attempts/hr per IP — stops spam floods
  const ip = getClientIp(req)
  if (!checkRateLimit(ip, 'newsletter')) {
    return rateLimitResponse(RATE_LIMITS.newsletter.windowMs)
  }

  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // ── 2. Honeypot check ────────────────────────────────────────────────────
    // [May 16, 2026] REASON: Real users never fill hidden fields. Bots always do.
    //   The frontend form must include a hidden <input name="website" tabIndex={-1} />
    //   styled with display:none. If it has any value, it's a bot — reject silently.
    if (body.website !== undefined && body.website !== '') {
      // [May 16, 2026] REASON: Return 200 to bots so they think it worked —
      //   if we return 400 they retry with different inputs.
      return NextResponse.json({ success: true })
    }

    // ── 3. Extract + sanitize email ──────────────────────────────────────────
    const rawEmail = body.email
    if (!rawEmail || typeof rawEmail !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // [May 16, 2026] REASON: Trim whitespace + lowercase — prevents duplicate
    //   entries like "User@Example.com" and "user@example.com"
    const email = rawEmail.trim().toLowerCase()

    if (email.length === 0) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // [May 16, 2026] REASON: Hard cap at 254 chars — RFC 5321 maximum
    if (email.length > 254) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // ── 4. Block obviously disposable/throwaway domains ──────────────────────
    // [May 16, 2026] REASON: Reduces junk in mailing list — common throwaway services
    const domain = email.split('@')[1]
    const BLOCKED_DOMAINS = ['mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwam.com', 'trashmail.com', 'yopmail.com', 'sharklasers.com']
    if (BLOCKED_DOMAINS.includes(domain)) {
      // [May 16, 2026] REASON: Return success to avoid leaking our block list
      return NextResponse.json({ success: true })
    }

    // ── 5. Insert into Supabase ──────────────────────────────────────────────
    const { error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .insert([{ email, created_at: new Date().toISOString() }])

    // [May 16, 2026] REASON: 23505 = unique violation (already subscribed).
    //   Return success:true — never reveal that email is already in DB (enumeration).
    if (error && error.code !== '23505') {
      console.error('[newsletter] insert error:', error.message)
      throw error
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('[newsletter] unexpected error:', err?.message ?? err)
    return NextResponse.json({ error: 'Failed to subscribe. Please try again.' }, { status: 500 })
  }
}
