// ============================================================
// FILE: app/api/search/log/route.ts
// PURPOSE: Log search queries to search_logs table for analytics
// LAST CHANGED: May 16, 2026
// WHY IT EXISTS: Powers admin analytics — what customers are searching for.
//   Called by SearchClient.tsx with 800ms debounce, fire-and-forget.
// DEPENDENCIES: lib/rateLimit.ts, Supabase (service role), search_logs table
// ⚠️ DO NOT CHANGE: Always returns 200 — SearchClient is fire-and-forget.
//   A non-200 here would cause unhandled promise rejections in the browser.
// ⚠️ DO NOT CHANGE: Service role key used — search_logs table has RLS that
//   blocks anon inserts (analytics data must be write-protected from clients).
// ⚠️ DO NOT CHANGE: Anti-spam filters must stay — without them a bot can
//   fill the search_logs table with garbage in seconds, corrupting all analytics.
// ============================================================

// --- CHANGE LOG ---
// [May 16, 2026] CREATED: New file — search/log/route.ts did not exist
// REASON: SearchClient was calling /api/search/log but no handler existed.
//   Built with full rate limiting, sanitization, and anti-spam from day one.
// --- END CHANGE LOG ---

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit'

// [May 16, 2026] REASON: Service role — search_logs likely has RLS blocking anon writes
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// [May 16, 2026] REASON: Queries must be meaningful text — strip anything that
//   could be used for injection or is clearly not a real search
const MAX_QUERY_LENGTH = 200
const MIN_QUERY_LENGTH = 2

// [May 16, 2026] REASON: Obvious bot/spam patterns — discard these silently
const SPAM_PATTERNS = [
  /<[^>]*>/,           // HTML tags
  /javascript:/i,      // JS injection attempts
  /on\w+\s*=/i,        // event handler injection (onclick=, onload= etc)
  /[<>'"`;\\]/,        // SQL/XSS special characters
  /\b(select|insert|update|delete|drop|union|exec|script)\b/i, // SQL keywords
]

export async function POST(req: Request) {
  // ── 1. Rate limit ─────────────────────────────────────────────────────────
  // [May 16, 2026] REASON: 30 logs/min per IP — generous for real users (debounced
  //   at 800ms in SearchClient so real max is ~75/min of searching), brutal for bots.
  //   Returns 200 always — SearchClient is fire-and-forget, must not throw.
  const ip = getClientIp(req)
  if (!checkRateLimit(ip, 'searchLog')) {
    return NextResponse.json({ logged: false, reason: 'rate_limited' }, { status: 200 })
  }

  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ logged: false }, { status: 200 })
    }

    // ── 2. Extract + validate fields ─────────────────────────────────────────
    const { query: rawQuery, resultCount, sessionId, userId } = body

    if (!rawQuery || typeof rawQuery !== 'string') {
      return NextResponse.json({ logged: false }, { status: 200 })
    }

    // ── 3. Sanitize query ────────────────────────────────────────────────────
    // [May 16, 2026] REASON: Trim, enforce length bounds, strip control characters
    const query = rawQuery.trim().replace(/[\x00-\x1F\x7F]/g, '')

    if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json({ logged: false, reason: 'invalid_length' }, { status: 200 })
    }

    // ── 4. Spam pattern check ─────────────────────────────────────────────────
    // [May 16, 2026] REASON: Discard injection attempts and obvious bot noise silently
    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(query)) {
        return NextResponse.json({ logged: false, reason: 'filtered' }, { status: 200 })
      }
    }

    // ── 5. Sanitize optional fields ──────────────────────────────────────────
    // [May 16, 2026] REASON: Never trust client-supplied IDs — validate shape only
    const safeSessionId = typeof sessionId === 'string'
      ? sessionId.slice(0, 64).replace(/[^a-z0-9]/gi, '')
      : null

    const safeUserId = typeof userId === 'string' && userId.length > 0
      ? userId.slice(0, 64)
      : null

    const safeResultCount = typeof resultCount === 'number' && resultCount >= 0
      ? Math.min(Math.round(resultCount), 9999)
      : 0

    // ── 6. Insert into Supabase ──────────────────────────────────────────────
    const { error } = await supabaseAdmin
      .from('search_logs')
      .insert([{
        query,
        result_count: safeResultCount,
        session_id: safeSessionId,
        user_id: safeUserId,
        created_at: new Date().toISOString(),
      }])

    if (error) {
      // [May 16, 2026] REASON: Log error server-side but never expose to client
      console.error('[search/log] insert error:', error.message)
      return NextResponse.json({ logged: false }, { status: 200 })
    }

    return NextResponse.json({ logged: true }, { status: 200 })

  } catch (err: any) {
    // [May 16, 2026] REASON: Always 200 — fire-and-forget must never throw in browser
    console.error('[search/log] unexpected error:', err?.message ?? err)
    return NextResponse.json({ logged: false }, { status: 200 })
  }
}
