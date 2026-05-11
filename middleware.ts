// ============================================================
// FILE: middleware.ts
// PURPOSE: Protect all /admin/* routes — redirect to login if no valid JWT
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Server-side route protection — cannot be bypassed client-side
// DEPENDENCIES: ADMIN_JWT_SECRET env var
// ⚠️ DO NOT CHANGE: matcher must include /admin/:path* — removing breaks auth
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only protect /admin routes
  if (!pathname.startsWith('/admin')) return NextResponse.next()

  // Allow login and setup pages through
  if (pathname === '/admin/login' || pathname === '/admin/setup') {
    return NextResponse.next()
  }

  // Allow API verify route through (used by client)
  if (pathname.startsWith('/api/admin/login') || pathname.startsWith('/api/admin/logout')) {
    return NextResponse.next()
  }

  const token = req.cookies.get('admin_token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }

  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!)
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    // Token invalid or expired
    const res = NextResponse.redirect(new URL('/admin/login', req.url))
    res.cookies.set('admin_token', '', { maxAge: 0, path: '/' })
    return res
  }
}

export const config = {
  matcher: ['/admin/:path*'],
}
