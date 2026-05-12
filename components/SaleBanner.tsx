// ============================================================
// FILE: components/SaleBanner.tsx
// PURPOSE: Thin top-of-navbar announcement strip shown when a
//   sale is active — displays name, discount %, and live countdown
// LAST CHANGED: May 12, 2026
// WHY IT EXISTS: Phase 8 — persistent sitewide sale visibility
//   without blocking page content. Fetches its own sale data.
// DEPENDENCIES: lib/activeSale.ts, components/SaleCountdown.tsx
// ⚠️ DO NOT CHANGE: Must return null (not empty div) when no
//   active sale — empty div shifts navbar height causing layout shift.
// ============================================================

// --- CHANGE LOG ---
// [May 12, 2026] CREATED: Navbar sale strip (Phase 8)
// REASON: Sitewide sale visibility per spec
// --- END CHANGE LOG ---

'use client'

import { useEffect, useState } from 'react'
import { ActiveSale, fetchActiveSale } from '@/lib/activeSale'
import SaleCountdown from './SaleCountdown'

export default function SaleBanner() {
  const [sale, setSale] = useState<ActiveSale | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetchActiveSale().then(setSale)
  }, [])

  // [May 12, 2026] REASON: Return null — not an empty div — to avoid navbar height shift
  if (!sale || dismissed) return null

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
