// ============================================================
// FILE: app/api/admin/products/route.ts
// PURPOSE: Fetch all products from Printify + manage visibility settings
// LAST CHANGED: May 13, 2026
// WHY IT EXISTS: Admin needs server-side product list with visibility control
// DEPENDENCIES: PRINTIFY_API_KEY, PRINTIFY_SHOP_ID, SUPABASE_SERVICE_ROLE_KEY
// ⚠️ DO NOT CHANGE: Uses service role for Supabase — needed to bypass RLS
// ⚠️ DO NOT CHANGE: cache: 'no-store' on Printify fetch — admin must always
//   see fresh data. next: { revalidate } was caching failed responses.
// ⚠️ DO NOT CHANGE: Both Authorization AND Content-Type headers are required.
//   Printify returns 400 if Content-Type is missing, even on GET requests.
// ============================================================

// --- CHANGE LOG ---
// [May 11, 2026] CREATED: Admin product management (Phase 3)
// [May 13, 2026] FIXED: Replaced next: { revalidate: 300 } with cache: 'no-store'
// REASON: Vercel was caching failed Printify responses for 5 minutes.
// [May 13, 2026] FIXED: Added missing Content-Type: application/json header
// REASON: Printify returns 400 without it — store route had it, admin route didn't.
//   This was the root cause of the persistent 400 error.
// --- END CHANGE LOG ---

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
  } catch {
    return false
  }
}

// GET — fetch all products with visibility settings
export async function GET(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const printifyRes = await fetch(
      `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/products.json?limit=20`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}`,
          // [May 13, 2026] REASON: Printify requires Content-Type even on GET requests.
          // Without it, Printify returns 400. The store route had this — admin route didn't.
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!printifyRes.ok) {
      const errorBody = await printifyRes.text()
      console.error(`[admin/products] Printify error ${printifyRes.status}:`, errorBody)
      return NextResponse.json(
        { error: `Printify API error: ${printifyRes.status}` },
        { status: 500 }
      )
    }

    const printifyData = await printifyRes.json()

    if (!printifyData?.data || !Array.isArray(printifyData.data)) {
      console.error('[admin/products] Unexpected Printify response shape:', JSON.stringify(printifyData).slice(0, 200))
      return NextResponse.json({ error: 'Unexpected Printify response' }, { status: 500 })
    }

    // Fetch visibility settings from Supabase
    const supabase = getAdminSupabase()
    const { data: settings } = await supabase
      .from('product_settings')
      .select('product_id, visibility')

    const visibilityMap: Record<string, string> = {}
    settings?.forEach(s => { visibilityMap[s.product_id] = s.visibility })

    const products = printifyData.data.map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description?.replace(/<[^>]*>/g, '').slice(0, 100) || '',
      price: p.variants[0]?.price / 100 || 0,
      image: p.images[0]?.src || '',
      category: p.tags?.[0]?.toLowerCase() || 'general',
      tags: p.tags || [],
      variantCount: p.variants?.length || 0,
      createdAt: p.created_at || new Date().toISOString(),
      visibility: visibilityMap[p.id] || 'public',
    }))

    return NextResponse.json({ products, total: products.length })

  } catch (err) {
    console.error('[admin/products] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

// PATCH — update visibility for a product
export async function PATCH(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { productId, visibility } = await req.json()

  if (!productId || !['public', 'members_only', 'hidden'].includes(visibility)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = getAdminSupabase()
  const { error } = await supabase
    .from('product_settings')
    .upsert(
      { product_id: productId, visibility, updated_at: new Date().toISOString() },
      { onConflict: 'product_id' }
    )

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  return NextResponse.json({ success: true })
}
