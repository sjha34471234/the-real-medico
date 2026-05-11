// ============================================================
// FILE: app/api/admin/reviews/route.ts
// PURPOSE: List all reviews across all products for admin
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Admin needs to see and reply to all reviews in one place
// DEPENDENCIES: SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verifyAdmin(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return false
  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!)
    await jwtVerify(token, secret)
    return true
  } catch { return false }
}

// GET — fetch all reviews with optional filter
export async function GET(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') || 'all' // all | unanswered | answered

  const supabase = getAdminSupabase()
  let query = supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })

  if (filter === 'unanswered') query = query.is('admin_reply', null)
  if (filter === 'answered') query = query.not('admin_reply', 'is', null)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  return NextResponse.json({ reviews: data || [] })
}

// PATCH — save admin reply to a review
export async function PATCH(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reviewId, admin_reply } = await req.json()
  if (!reviewId) return NextResponse.json({ error: 'reviewId required' }, { status: 400 })

  const supabase = getAdminSupabase()
  const { error } = await supabase
    .from('reviews')
    .update({ admin_reply: admin_reply || null })
    .eq('id', reviewId)

  if (error) return NextResponse.json({ error: 'Failed to save reply' }, { status: 500 })
  return NextResponse.json({ success: true })
}
