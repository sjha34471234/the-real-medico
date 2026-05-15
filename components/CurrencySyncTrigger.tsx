'use client'
// ============================================================
// FILE: components/CurrencySyncTrigger.tsx
// PURPOSE: Silently fire /api/currency/sync on every page load
// LAST CHANGED: May 15, 2026
// WHY IT EXISTS: layout.tsx is a server component — it cannot use useEffect.
//   This tiny client component bridges that gap: mounts on every page and
//   fires a fire-and-forget POST to the sync route.
//   The sync route gates execution to once per hour via Supabase updated_at —
//   so this firing on every page load is safe.
// DEPENDENCIES: /api/currency/sync
// ⚠️ DO NOT CHANGE: fire-and-forget — no await, no error shown to user.
// ⚠️ DO NOT CHANGE: renders null — no UI output whatsoever.
// ============================================================

// --- CHANGE LOG ---
// [May 15, 2026] CREATED
// REASON: useEffect cannot run in server components. This wrapper lets
//   layout.tsx trigger currency sync without converting to 'use client'
//   (which would break metadata exports and font preloads).
// --- END CHANGE LOG ---

import { useEffect } from 'react'

export default function CurrencySyncTrigger() {
  useEffect(() => {
    // May 15, 2026 REASON: Fire-and-forget — sync failure never interrupts user.
    //   Sync route is rate-limited + hour-gated — safe to call on every mount.
    fetch('/api/currency/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {
      // Intentionally silent
    })
  }, [])

  return null
}
