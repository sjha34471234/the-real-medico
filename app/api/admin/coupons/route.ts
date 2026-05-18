// ============================================================
// FILE: app/api/admin/coupons/route.ts
// PURPOSE: Admin CRUD for coupons — GET (list all) / POST (create) /
//   PATCH (toggle active / edit) / DELETE.
// LAST CHANGED: May 19, 2026
// WHY IT EXISTS: Admin dashboard needs to manage coupon codes.
// DEPENDENCIES: lib/rateLimit.ts, Supabase service role client
// ⚠️ DO NOT CHANGE: All handlers verify JWT cookie FIRST — same pattern as
//   all other admin routes (api/admin/sales, api/admin/products, etc.)
// ⚠️ DO NOT CHANGE: Uses SUPABASE_SERVICE_ROLE_KEY — bypasses RLS.
//   This is intentional — admin needs full read/write on coupons + coupon_uses.
// ============================================================

// --- CHANGE LOG ---
// [May 19, 2026] CREATED: New admin route for coupon CRUD
// REASON: Coupon system Tier 3 feature.
// --- END CHANGE LOG ---

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'

// May 19, 2026 REASON: Service role — admin needs full access including coupon_uses counts.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifyAdminCookie(req: NextRequest): Promise<boolean> {
  try {
    const token = req.cookies.get('admin_token')?.value
    if (!token) return false
    await jwtVerify(token, new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!))
    return true
  } catch {
    return false
  }
}

// ── GET — list all coupons with use counts ────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!(await verifyAdminCookie(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ coupons: data })
}

// ── POST — create a new coupon ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await verifyAdminCookie(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  const {
    code, type, value,
    min_order_usd, max_uses, one_per_user,
    members_only, non_members_only, expires_at,
  } = body

  // ── Validate required fields ──────────────────────────────────────────────
  if (!code || typeof code !== 'string' || !code.trim()) {
    return NextResponse.json({ error: 'Code is required.' }, { status: 400 })
  }
  if (!['percent', 'fixed', 'shipping'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type.' }, { status: 400 })
  }
  if (type !== 'shipping' && (typeof value !== 'number' || value <= 0)) {
    return NextResponse.json({ error: 'Value must be positive.' }, { status: 400 })
  }
  if (type === 'percent' && value > 100) {
    return NextResponse.json({ error: 'Percent cannot exceed 100.' }, { status: 400 })
  }
  // May 19, 2026 REASON: members_only + non_members_only can't both be true.
  if (members_only && non_members_only) {
    return NextResponse.json(
      { error: 'Coupon cannot be both members-only and non-members-only.' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('coupons')
    .insert({
      code:             code.trim().toUpperCase(),
      type,
      value:            type === 'shipping' ? 0 : value,
      min_order_usd:    min_order_usd   ?? 0,
      max_uses:         max_uses        ?? null,
      one_per_user:     one_per_user    ?? true,
      members_only:     members_only    ?? false,
      non_members_only: non_members_only ?? false,
      expires_at:       expires_at      ?? null,
      active:           true,
      uses:             0,
    })
    .select()
    .single()

  if (error) {
    // May 19, 2026 REASON: Unique constraint on code column — surface as friendly error.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A coupon with this code already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ coupon: data }, { status: 201 })
}

// ── PATCH — update a coupon (toggle active or full edit) ─────────────────────
export async function PATCH(req: NextRequest) {
  if (!(await verifyAdminCookie(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || !body.id) return NextResponse.json({ error: 'ID required.' }, { status: 400 })

  const { id, ...updates } = body

  // May 19, 2026 REASON: Prevent overwriting immutable fields via PATCH.
  delete updates.uses
  delete updates.created_at
  // Normalise code to uppercase if being updated
  if (updates.code) updates.code = updates.code.trim().toUpperCase()

  const { data, error } = await supabase
    .from('coupons')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ coupon: data })
}

// ── DELETE — delete a coupon ──────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdminCookie(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required.' }, { status: 400 })

  // May 19, 2026 REASON: Delete coupon_uses first — FK constraint prevents deleting coupon with uses.
  await supabase.from('coupon_uses').delete().eq('coupon_id', id)

  const { error } = await supabase.from('coupons').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
