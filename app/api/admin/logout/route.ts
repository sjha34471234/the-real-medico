// ============================================================
// FILE: app/api/admin/logout/route.ts
// PURPOSE: Clear admin session cookie
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Secure logout — clears httpOnly cookie server-side
// ============================================================

import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json({ success: true })
  res.cookies.set('admin_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  })
  return res
}
