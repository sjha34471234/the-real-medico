// ============================================================
// FILE: app/api/search/log/route.ts
// PURPOSE: Log search queries with anti-spam/bot protection
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Search analytics — need clean data without spam/bots
// DEPENDENCIES: SUPABASE_SERVICE_ROLE_KEY, search_logs table
// ⚠️ DO NOT CHANGE: All anti-spam logic is server-side — cannot be bypassed client-side
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Anti-spam: in-memory rate limit store ──
// Structure: ip_hash → { count, windowStart, lastQuery, lastQueryTime }
const rateLimitStore = new Map<string, {
  count: number
  windowStart: number
  lastQuery: string
  lastQueryTime: number
}>()

const RATE_LIMIT_WINDOW_MS = 60 * 1000  // 1 minute window
const MAX_SEARCHES_PER_WINDOW = 20       // 20 searches/minute max
const MIN_QUERY_INTERVAL_MS = 200        // 200ms between searches (5/sec max)
const DUPLICATE_SUPPRESS_MS = 5000      // same query within 5s = don't log again

// Known bot user-agent patterns
const BOT_UA_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /scraper/i, /curl/i, /wget/i,
  /python/i, /axios/i, /node-fetch/i, /headless/i, /phantom/i,
  /selenium/i, /puppeteer/i, /playwright/i,
]

function hashIp(ip: string): string {
  // Hash IP for privacy — we track patterns not identities
  return createHash('sha256').update(ip + 'trm_salt_2026').digest('hex').slice(0, 16)
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

function isBot(userAgent: string | null): boolean {
  if (!userAgent) return true // No UA = likely bot
  return BOT_UA_PATTERNS.some(pattern => pattern.test(userAgent))
}

function checkRateLimit(ipHash: string, query: string): {
  allowed: boolean
  reason?: string
} {
  const now = Date.now()
  const record = rateLimitStore.get(ipHash)

  if (!record) {
    rateLimitStore.set(ipHash, {
      count: 1,
      windowStart: now,
      lastQuery: query,
      lastQueryTime: now,
    })
    return { allowed: true }
  }

  // Reset window if expired
  if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ipHash, {
      count: 1,
      windowStart: now,
      lastQuery: query,
      lastQueryTime: now,
    })
    return { allowed: true }
  }

  // Too fast (more than 5/sec)
  if (now - record.lastQueryTime < MIN_QUERY_INTERVAL_MS) {
    return { allowed: false, reason: 'too_fast' }
  }

  // Duplicate query within suppression window
  if (
    record.lastQuery.toLowerCase() === query.toLowerCase() &&
    now - record.lastQueryTime < DUPLICATE_SUPPRESS_MS
  ) {
    return { allowed: false, reason: 'duplicate' }
  }

  // Over rate limit
  if (record.count >= MAX_SEARCHES_PER_WINDOW) {
    return { allowed: false, reason: 'rate_limit' }
  }

  // Update record
  rateLimitStore.set(ipHash, {
    count: record.count + 1,
    windowStart: record.windowStart,
    lastQuery: query,
    lastQueryTime: now,
  })
  return { allowed: true }
}

export async function POST(req: NextRequest) {
  try {
    const { query, resultCount, sessionId, userId } = await req.json()

    // ── Validation ──
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ logged: false, reason: 'invalid' })
    }

    const trimmed = query.trim()

    // Too short or too long
    if (trimmed.length < 2 || trimmed.length > 100) {
      return NextResponse.json({ logged: false, reason: 'length' })
    }

    // Pure numbers only (e.g. "123") — not useful signal
    if (/^\d+$/.test(trimmed)) {
      return NextResponse.json({ logged: false, reason: 'numeric_only' })
    }

    // ── Bot detection ──
    const userAgent = req.headers.get('user-agent')
    if (isBot(userAgent)) {
      return NextResponse.json({ logged: false, reason: 'bot' })
    }

    // ── Rate limiting ──
    const ip = getClientIp(req)
    const ipHash = hashIp(ip)
    const rateCheck = checkRateLimit(ipHash, trimmed)

    if (!rateCheck.allowed) {
      return NextResponse.json({ logged: false, reason: rateCheck.reason })
    }

    // ── Log to Supabase ──
    const supabase = getAdminSupabase()
    await supabase.from('search_logs').insert({
      query: trimmed.toLowerCase(),
      user_id: userId || null,
      ip_hash: ipHash,
      session_id: sessionId || null,
      result_count: resultCount ?? null,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ logged: true })
  } catch {
    // Silent fail — never block the user's search experience
    return NextResponse.json({ logged: false, reason: 'error' })
  }
}
