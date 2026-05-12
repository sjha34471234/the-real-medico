// ============================================================
// FILE: app/api/admin/sales/route.ts
// PURPOSE: Admin CRUD for SALES+ campaigns
// LAST CHANGED: May 12, 2026
// WHY IT EXISTS: Phase 8 — allows admin to create, schedule,
//   activate, pause, and force-end sale campaigns
// DEPENDENCIES: Supabase sales table, verifyAdmin JWT helper,
//   SUPABASE_SERVICE_ROLE_KEY
// ⚠️ DO NOT CHANGE: JWT verify must run before any DB operation.
//   Always use service role key — sales table may have RLS.
// ============================================================

// --- CHANGE LOG ---
// [May 12, 2026] CREATED: Full CRUD for sales campaigns (Phase 8)
// REASON: Admin needs to create/schedule/pause/end SALES+ campaigns
// --- END CHANGE LOG ---

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'

// [May 12, 2026] REASON: Service role bypasses RLS for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// [May 12, 2026] REASON: Reusable admin JWT verifier — same pattern as all admin routes
async function verifyAdmin(req: NextRequest): Promise<boolean> {
  try {
    const token = req.cookies.get('admin_token')?.value
    if (!token) return false
    await jwtVerify(
      token,
      new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!)
    )
    return true
  } catch {
    return false
  }
}

// ─── GET — list all sales (newest first) ───────────────────────────────────
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // [May 12, 2026] REASON: Auto-expire any active sales whose end_date has passed.
  // No cron needed — we lazily mark them ended on each admin load.
  const now = new Date().toISOString()
  const expiredIds = (data ?? [])
    .filter((s) => s.status === 'active' && s.end_date && s.end_date < now)
    .map((s) => s.id)

  if (expiredIds.length > 0) {
    await supabase
      .from('sales')
      .update({ status: 'ended' })
      .in('id', expiredIds)

    // Reflect the update in the returned data without a second fetch
    data?.forEach((s) => {
      if (expiredIds.includes(s.id)) s.status = 'ended'
    })
  }

  // [May 12, 2026] REASON: Auto-activate any scheduled sales whose start_date has passed
  const now2 = new Date().toISOString()
  const readyIds = (data ?? [])
    .filter((s) => s.status === 'scheduled' && s.start_date && s.start_date <= now2)
    .map((s) => s.id)

  if (readyIds.length > 0) {
    await supabase
      .from('sales')
      .update({ status: 'active' })
      .in('id', readyIds)

    data?.forEach((s) => {
      if (readyIds.includes(s.id)) s.status = 'active'
    })
  }

  return NextResponse.json({ sales: data ?? [] })
}

// ─── POST — create a new sale ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    name,
    color,
    discount_percent,
    scope,        // 'all' | 'specific' | 'category'
    product_ids,  // string[] — only used when scope === 'specific'
    category,     // string   — only used when scope === 'category'
    start_date,   // ISO string — if in future → scheduled, if now/past → active
    end_date,     // ISO string
  } = body

  // [May 12, 2026] REASON: Validate required fields before touching DB
  if (!name || !discount_percent || !scope || !end_date) {
    return NextResponse.json(
      { error: 'name, discount_percent, scope, and end_date are required' },
      { status: 400 }
    )
  }

  if (discount_percent < 1 || discount_percent > 90) {
    return NextResponse.json(
      { error: 'discount_percent must be between 1 and 90' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()
  // [May 12, 2026] REASON: If start_date is in the future → scheduled, else → active immediately
  const effectiveStart = start_date || now
  const status = effectiveStart > now ? 'scheduled' : 'active'

  const { data, error } = await supabase
    .from('sales')
    .insert({
      name,
      color: color || '#EF4444',
      discount_percent,
      scope,
      product_ids: scope === 'specific' ? (product_ids ?? []) : [],
      category: scope === 'category' ? (category ?? null) : null,
      start_date: effectiveStart,
      end_date,
      status,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sale: data }, { status: 201 })
}

// ─── PATCH — update or change status of existing sale ─────────────────────
export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { id, action, ...fields } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // [May 12, 2026] REASON: action shortcuts for status transitions
  // Supported: 'activate' | 'pause' | 'end' | 'update'
  let updatePayload: Record<string, unknown> = {}

  if (action === 'activate') {
    updatePayload = { status: 'active' }
  } else if (action === 'pause') {
    updatePayload = { status: 'paused' }
  } else if (action === 'end') {
    // [May 12, 2026] REASON: Force-end sets end_date to now so countdown disappears immediately
    updatePayload = { status: 'ended', end_date: new Date().toISOString() }
  } else {
    // Generic field update (name, color, discount_percent, dates, scope, etc.)
    const allowed = [
      'name', 'color', 'discount_percent', 'scope',
      'product_ids', 'category', 'start_date', 'end_date',
    ]
    for (const key of allowed) {
      if (fields[key] !== undefined) updatePayload[key] = fields[key]
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('sales')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sale: data })
}

// ─── DELETE — permanently remove a sale ───────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const { error } = await supabase.from('sales').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
