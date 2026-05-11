// ============================================================
// FILE: app/api/admin/setup/route.ts
// PURPOSE: Change admin password — verifies current, hashes new, stores in Supabase
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Admin needs to change password without touching code or env vars
// DEPENDENCIES: ADMIN_JWT_SECRET, SUPABASE_SERVICE_ROLE_KEY
// ⚠️ DO NOT CHANGE: Must verify current password before allowing change
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  // Must be logged in as admin
  const token = req.cookies.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!)
    await jwtVerify(token, secret)
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const { currentPassword, newPassword } = await req.json()

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Both passwords required' }, { status: 400 })
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
  }

  // Verify current password
  const storedHash = process.env.ADMIN_PASSWORD_HASH
  let currentValid = false

  if (!storedHash) {
    currentValid = currentPassword === 'realmedico2024'
  } else {
    currentValid = await bcrypt.compare(currentPassword, storedHash)
  }

  if (!currentValid) {
    return NextResponse.json({ error: 'Current password is wrong' }, { status: 401 })
  }

  // Hash new password
  const newHash = await bcrypt.hash(newPassword, 12)

  // Store in Supabase admin_settings table so it persists without env var changes
  const supabase = getAdminSupabase()
  const { error } = await supabase
    .from('admin_settings')
    .upsert({ key: 'password_hash', value: newHash }, { onConflict: 'key' })

  if (error) {
    return NextResponse.json({ error: 'Failed to save new password' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
