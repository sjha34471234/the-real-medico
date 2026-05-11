// ============================================================
// FILE: app/api/admin/verify/route.ts
// PURPOSE: Verify admin JWT cookie — used by client to check session
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Client needs to verify session without exposing JWT logic
// DEPENDENCIES: ADMIN_JWT_SECRET env var
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return NextResponse.json({ valid: false }, { status: 401 })

  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!)
    await jwtVerify(token, secret)
    return NextResponse.json({ valid: true })
  } catch {
    return NextResponse.json({ valid: false }, { status: 401 })
  }
}
