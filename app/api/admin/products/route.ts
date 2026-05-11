// ============================================================
// FILE: app/api/admin/products/route.ts
// PURPOSE: Fetch all products from Printify + manage visibility settings
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Admin needs server-side product list with visibility control
// DEPENDENCIES: PRINTIFY_API_KEY, PRINTIFY_SHOP_ID, SUPABASE_SERVICE_ROLE_KEY
// ⚠️ DO NOT CHANGE: Uses service role for Supabase — needed to bypass RLS
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
    // Fetch from Printify
    const printifyRes = await fetch(
      `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/products.json?limit=100`,
      {
        headers: { Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}` },
        next: { revalidate: 300 }, // 5 min cache for admin
      }
    )
    if (!printifyRes.ok) throw new Error('Printify fetch failed')
    const printifyData = await printifyRes.json()

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
      visibility: visibilityMap[p.id] || 'public', // 'public' | 'members_only' | 'hidden'
    }))

    return NextResponse.json({ products, total: products.length })
  } catch (err) {
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
    .upsert({ product_id: productId, visibility, updated_at: new Date().toISOString() }, { onConflict: 'product_id' })

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  return NextResponse.json({ success: true })
}
