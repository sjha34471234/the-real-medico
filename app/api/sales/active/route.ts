// ============================================================
// FILE: app/api/sales/active/route.ts
// PURPOSE: Public endpoint — returns the single active sale with
//   the highest discount percent (highest-wins rule)
// LAST CHANGED: May 12, 2026
// WHY IT EXISTS: All public-facing sale components (Navbar strip,
//   homepage banner, shop, product, cart) call this one endpoint.
//   No auth required — sale data is public.
// DEPENDENCIES: Supabase sales table, SUPABASE_SERVICE_ROLE_KEY
// ⚠️ DO NOT CHANGE: Must filter by status='active' AND
//   start_date <= now AND end_date >= now — all three conditions.
//   Removing any condition causes stale/future sales to leak.
// ============================================================

// --- CHANGE LOG ---
// [May 12, 2026] CREATED: Public active sale endpoint (Phase 8)
// REASON: All countdown/banner components need one shared data source
// --- END CHANGE LOG ---

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// [May 12, 2026] REASON: Service role used here so RLS never blocks
// public sale reads — sale data is intentionally public
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const now = new Date().toISOString()

  // [May 12, 2026] REASON: All three filters required:
  // 1. status = active (not scheduled/paused/ended)
  // 2. start_date <= now (has actually started)
  // 3. end_date >= now (has not expired yet)
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('status', 'active')
    .lte('start_date', now)
    .gte('end_date', now)
    .order('discount_percent', { ascending: false }) // highest-wins
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ sale: null }, { status: 200 })
  }

  // [May 12, 2026] REASON: Cache for 60s on CDN — sale data changes infrequently
  // and we want fast loads without hammering Supabase on every product page
  return NextResponse.json(
    { sale: data ?? null },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    }
  )
}
