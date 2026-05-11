// ============================================================
// FILE: app/api/admin/login/route.ts
// PURPOSE: Verify admin password, issue httpOnly JWT session cookie
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Replaces plaintext client-side password check in old admin/page.tsx
// DEPENDENCIES: ADMIN_JWT_SECRET env var, admin_settings Supabase table
// ⚠️ DO NOT CHANGE: httpOnly + sameSite strict cookie settings — security critical
// ⚠️ DO NOT CHANGE: Password hash priority: Supabase > env var > bootstrap default
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

// [May 11] REASON: declared outside handler — single instance per cold start
const getAdminSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Rate limiting store (in-memory, resets on cold start — acceptable for admin)
const attempts = new Map<string, { count: number; lockedUntil: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

async function getStoredHash(): Promise<string | null> {
  // Priority 1: Supabase admin_settings (set via /admin/setup)
  try {
    const supabase = getAdminSupabase()
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'password_hash')
      .single()
    if (data?.value) return data.value
  } catch {}

  // Priority 2: Env var (legacy fallback)
  if (process.env.ADMIN_PASSWORD_HASH) return process.env.ADMIN_PASSWORD_HASH

  // Priority 3: No hash set — bootstrap mode
  return null
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const now = Date.now()

  // Check lockout
  const record = attempts.get(ip)
  if (record && record.lockedUntil > now) {
    const minutesLeft = Math.ceil((record.lockedUntil - now) / 60000)
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.` },
      { status: 429 }
    )
  }

  const { password } = await req.json()
  if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 })

  const jwtSecret = process.env.ADMIN_JWT_SECRET
  if (!jwtSecret) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })

  const storedHash = await getStoredHash()

  // Verify password
  let isValid = false
  const needsSetup = !storedHash

  if (!storedHash) {
    // Bootstrap: accept default password, prompt to change
    isValid = password === 'realmedico2024'
  } else {
    isValid = await bcrypt.compare(password, storedHash)
  }

  if (!isValid) {
    const current = attempts.get(ip) || { count: 0, lockedUntil: 0 }
    const newCount = current.count + 1
    if (newCount >= MAX_ATTEMPTS) {
      attempts.set(ip, { count: newCount, lockedUntil: now + LOCKOUT_MS })
      return NextResponse.json(
        { error: 'Too many failed attempts. Locked for 15 minutes.' },
        { status: 429 }
      )
    }
    attempts.set(ip, { count: newCount, lockedUntil: 0 })
    const remaining = MAX_ATTEMPTS - newCount
    return NextResponse.json(
      { error: `Wrong password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` },
      { status: 401 }
    )
  }

  // Clear attempts on success
  attempts.delete(ip)

  // Issue JWT (24 hour session)
  const secret = new TextEncoder().encode(jwtSecret)
  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret)

  const res = NextResponse.json({ success: true, needsSetup })
  res.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })

  return res
}
