// ============================================================
// FILE: app/api/debug-printify/route.ts
// PURPOSE: Temporary debug endpoint — diagnose Printify API issues
// LAST CHANGED: May 13, 2026
// WHY IT EXISTS: Persistent 400 error on all Printify calls — need to
//   see what shops/tokens are accessible with the current API key
// ⚠️ DELETE THIS FILE after debugging is complete — it exposes shop info
// ============================================================

import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.PRINTIFY_API_KEY
  const shopId = process.env.PRINTIFY_SHOP_ID

  // [May 13, 2026] REASON: Check what the env vars actually contain
  const keyPreview = apiKey
    ? `${apiKey.slice(0, 10)}...${apiKey.slice(-6)} (length: ${apiKey.length})`
    : 'MISSING'

  // Step 1: Try to get list of shops (no shop ID needed)
  let shopsResult: any = null
  let shopsError: any = null
  try {
    const res = await fetch('https://api.printify.com/v1/shops.json', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })
    const text = await res.text()
    shopsResult = { status: res.status, body: text.slice(0, 500) }
  } catch (e: any) {
    shopsError = e.message
  }

  // Step 2: Try to get products from the configured shop ID
  let productsResult: any = null
  let productsError: any = null
  try {
    const res = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/products.json?limit=5`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )
    const text = await res.text()
    productsResult = { status: res.status, body: text.slice(0, 500) }
  } catch (e: any) {
    productsError = e.message
  }

  return NextResponse.json({
    keyPreview,
    configuredShopId: shopId || 'MISSING',
    shops: shopsResult,
    shopsError,
    products: productsResult,
    productsError,
  })
}
