// ============================================================
// FILE: components/SaleCountdown.tsx
// PURPOSE: Reusable sale countdown block — shows discount %,
//   sale name, and live HH:MM:SS (+ days if > 24h) countdown
// LAST CHANGED: May 12, 2026
// WHY IT EXISTS: Phase 8 — used on Homepage, Shop, Product detail,
//   and Cart pages. Takes an ActiveSale prop — parent fetches once.
// DEPENDENCIES: lib/activeSale.ts (getCountdownParts)
// ⚠️ DO NOT CHANGE: setInterval must be cleared in useEffect
//   cleanup — leaks timers if removed.
// ============================================================

// --- CHANGE LOG ---
// [May 12, 2026] CREATED: Reusable countdown widget (Phase 8)
// REASON: All page-level sale displays share identical timer logic
// --- END CHANGE LOG ---

'use client'

import { useEffect, useState } from 'react'
import { ActiveSale, getCountdownParts } from '@/lib/activeSale'

interface Props {
  sale: ActiveSale
  /** compact: small inline badge. full: large banner block */
  variant?: 'compact' | 'full'
  className?: string
}

export default function SaleCountdown({
  sale,
  variant = 'full',
  className = '',
}: Props) {
  const [parts, setParts] = useState(() => getCountdownParts(sale.end_date))

  // [May 12, 2026] REASON: Tick every second. Cleanup required to prevent timer leak.
  useEffect(() => {
    const interval = setInterval(() => {
      setParts(getCountdownParts(sale.end_date))
    }, 1000)
    return () => clearInterval(interval)
  }, [sale.end_date])

  if (parts.expired) return null

  const pad = (n: number) => String(n).padStart(2, '0')

  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-sm font-semibold ${className}`}
        style={{ color: sale.color }}
      >
        <span
          className="px-1.5 py-0.5 rounded text-white text-xs font-bold"
          style={{ backgroundColor: sale.color }}
        >
          -{sale.discount_percent}%
        </span>
        {parts.days > 0 && <span>{parts.days}d </span>}
        <span>
          {pad(parts.hours)}:{pad(parts.minutes)}:{pad(parts.seconds)}
        </span>
      </span>
    )
  }

  // full variant
  return (
    <div
      className={`rounded-xl p-4 text-white ${className}`}
      style={{ backgroundColor: sale.color }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
            Limited Time Sale
          </p>
          <p className="text-lg font-bold leading-tight">{sale.name}</p>
          <p className="text-sm opacity-90">
            {sale.discount_percent}% off{' '}
            {sale.scope === 'all'
              ? 'everything'
              : sale.scope === 'category'
              ? `all ${sale.category} products`
              : 'selected products'}
          </p>
        </div>

        {/* Countdown blocks */}
        <div className="flex items-center gap-2">
          {parts.days > 0 && (
            <>
              <CountBlock value={parts.days} label="Days" />
              <Colon />
            </>
          )}
          <CountBlock value={parts.hours} label="Hrs" />
          <Colon />
          <CountBlock value={parts.minutes} label="Min" />
          <Colon />
          <CountBlock value={parts.seconds} label="Sec" />
        </div>
      </div>
    </div>
  )
}

function CountBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center bg-white bg-opacity-20 rounded-lg px-3 py-1.5 min-w-[3rem]">
      <span className="text-xl font-bold tabular-nums leading-none">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] uppercase tracking-wider opacity-80">
        {label}
      </span>
    </div>
  )
}

function Colon() {
  return (
    <span className="text-xl font-bold opacity-60 pb-3 select-none">:</span>
  )
}
