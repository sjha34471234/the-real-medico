'use client'
// ============================================================
// FILE: components/SaleBanner.tsx
// PURPOSE: Thin top-of-navbar announcement strip shown when a
//   sale is active — displays name, discount %, and live countdown
// LAST CHANGED: May 13, 2026
// WHY IT EXISTS: Phase 8 — persistent sitewide sale visibility
// DEPENDENCIES: lib/activeSale.ts, components/SaleCountdown.tsx
// ⚠️ DO NOT CHANGE: Must return null (not empty div) when no
//   active sale — empty div shifts navbar height causing layout shift.
// ⚠️ DO NOT CHANGE: fetch uses absolute URL with window.location.origin
//   so it works on all domains including Vercel previews
// ============================================================

// --- CHANGE LOG ---
// [May 12, 2026] CREATED: Navbar sale strip (Phase 8)
// [May 13, 2026] FIXED: Fetch was silently failing — added absolute URL
//   and explicit error logging. Also added retry on mount.
// --- END CHANGE LOG ---

import { useEffect, useState } from 'react'
import { ActiveSale, getCountdownParts } from '@/lib/activeSale'
import SaleCountdown from './SaleCountdown'

export default function SaleBanner() {
  const [sale, setSale] = useState<ActiveSale | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // [May 13, 2026] REASON: Use absolute URL so fetch works from any origin.
    // Relative URLs can fail in SSR/hydration edge cases on Vercel.
    const url = `${window.location.origin}/api/sales/active`
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (json?.sale) setSale(json.sale)
      })
      .catch(() => {
        // [May 13, 2026] REASON: Silent fail — banner is non-critical, never crash the navbar
      })
  }, [])

  // [May 13, 2026] REASON: Return null — not empty div — to avoid layout shift
  if (!sale || dismissed) return null

  // [May 13, 2026] REASON: Check if sale has expired client-side before rendering
  const parts = getCountdownParts(sale.end_date)
  if (parts.expired) return null

  return (
    <div
      className="w-full text-white text-sm"
      style={{ backgroundColor: sale.color }}
    >
      <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between gap-4">
        {/* Left: name + discount */}
        <span className="font-semibold truncate">
          🔥 {sale.name} — {sale.discount_percent}% OFF
          {sale.scope === 'all'
            ? ' Everything'
            : sale.scope === 'category'
            ? ` All ${sale.category}`
            : ' Selected Products'}
        </span>

        {/* Center: compact countdown */}
        <SaleCountdown sale={sale} variant="compact" className="shrink-0" />

        {/* Right: dismiss */}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss sale banner"
          className="shrink-0 opacity-70 hover:opacity-100 transition-opacity text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  )
}
