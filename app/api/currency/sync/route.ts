// ============================================================
// FILE: app/api/currency/sync/route.ts
// PURPOSE: Fetch live rates, apply ratchet rule, save peaks to Supabase
// LAST CHANGED: May 16, 2026
// WHY IT EXISTS: Prices only ever go up — peak_rate is the floor.
//   If live rate > stored peak → update peak (price rises).
//   If live rate < stored peak → keep peak as-is (price never falls).
//   Called silently from layout.tsx on every page load, max once per hour
//   (gated by updated_at timestamp in Supabase — no cron job needed).
// DEPENDENCIES: lib/rateLimit.ts, SUPABASE_SERVICE_ROLE_KEY,
//   NEXT_PUBLIC_SUPABASE_URL, open.er-api.com (free, no key needed)
// ⚠️ DO NOT CHANGE: Ratchet rule — peak only goes up, never down.
//   The only exception is a manual admin override via Supabase SQL Editor.
// ⚠️ DO NOT CHANGE: Uses service role key — bypasses RLS for writes.
// ⚠️ DO NOT CHANGE: cache: 'no-store' on live rate fetch — stale rates
//   would silently fail to trigger ratchet updates.
// ⚠️ DO NOT CHANGE: Rate limit returns 200 not 429 — layout.tsx fires this
//   silently on every page load; a 429 would cause console errors for normal users.
// ============================================================

// --- CHANGE LOG ---
// [May 15, 2026] CREATED: Peak-rate ratchet system
// REASON: Hardcoded rates (83 INR/USD) caused price mismatch vs live rates (~95).
//   Prices were displaying one amount and Razorpay charging a different amount.
//   Also: business rule = prices never go down even if currency recovers.
// [May 16, 2026] CHANGED: Removed inline rate limiter, now uses shared lib/rateLimit.ts
// REASON: Inline limiter was duplicated logic. Centralised in lib/rateLimit.ts.
//   IMPORTANT: Still returns 200 on rate limit (not 429) — layout.tsx is silent.
// --- END CHANGE LOG ---

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit'

// May 15, 2026 REASON: Service role — needs write access to currency_rates.
//   RLS blocks anon writes. Service role bypasses RLS safely on server only.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type CurrencyCode = 'INR' | 'USD' | 'GBP' | 'AED' | 'SGD' | 'MYR' | 'AUD' | 'CAD'

const SUPPORTED: CurrencyCode[] = ['INR', 'USD', 'GBP', 'AED', 'SGD', 'MYR', 'AUD', 'CAD']

// May 15, 2026 REASON: Fallback rates if open.er-api.com is down.
//   Approximate May 2026 values. Used as last resort only.
const FALLBACK_RATES: Record<CurrencyCode, number> = {
  INR: 95, USD: 1, GBP: 0.79, AED: 3.67,
  SGD: 1.34, MYR: 4.7, AUD: 1.53, CAD: 1.36,
}

export async function POST(req: Request) {
  // [May 16, 2026] REASON: Migrated from inline rate limiter to shared lib/rateLimit.ts
  // CRITICAL: Return 200 not 429 — layout.tsx fires this silently on every page load.
  //   A non-200 response would cause browser console errors for completely normal traffic.
  const ip = getClientIp(req)
  if (!checkRateLimit(ip, 'currencySync')) {
    return NextResponse.json({ skipped: true, reason: 'rate_limited' }, { status: 200 })
  }

  try {
    // ── 1. One-hour gate — check most recently updated row ────────────────────
    // May 15, 2026 REASON: Prevents hammering open.er-api.com on every page load
    //   across all visitors. One sync per hour site-wide regardless of traffic.
    const { data: recentRow } = await supabaseAdmin
      .from('currency_rates')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recentRow?.updated_at) {
      const lastSync = new Date(recentRow.updated_at).getTime()
      const oneHourAgo = Date.now() - 60 * 60 * 1000
      if (lastSync > oneHourAgo) {
        return NextResponse.json({ skipped: true, reason: 'synced_recently' }, { status: 200 })
      }
    }

    // ── 2. Fetch current stored peaks from Supabase ───────────────────────────
    const { data: storedRows, error: fetchError } = await supabaseAdmin
      .from('currency_rates')
      .select('currency, rate, peak_rate')

    if (fetchError) throw new Error(`Supabase fetch failed: ${fetchError.message}`)

    const storedPeaks: Partial<Record<CurrencyCode, number>> = {}
    for (const row of storedRows ?? []) {
      storedPeaks[row.currency as CurrencyCode] = Number(row.peak_rate)
    }

    // ── 3. Fetch live rates ───────────────────────────────────────────────────
    // May 15, 2026 REASON: cache: 'no-store' — must be truly live, not CDN cached.
    let liveRates: Record<CurrencyCode, number> = { ...FALLBACK_RATES }
    let usedFallback = false
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', {
        cache: 'no-store',
      })
      const data = await res.json()
      if (data.result === 'success') {
        liveRates = {
          INR: Number(data.rates.INR),
          USD: 1,
          GBP: Number(data.rates.GBP),
          AED: Number(data.rates.AED),
          SGD: Number(data.rates.SGD),
          MYR: Number(data.rates.MYR),
          AUD: Number(data.rates.AUD),
          CAD: Number(data.rates.CAD),
        }
      } else {
        usedFallback = true
      }
    } catch {
      // May 15, 2026 REASON: If live fetch fails we still upsert (with fallback rates)
      //   so updated_at refreshes — stops hammering the dead endpoint for 1 hour.
      usedFallback = true
      console.warn('[currency/sync] live rate fetch failed, using fallback rates')
    }

    // ── 4. Apply ratchet rule ─────────────────────────────────────────────────
    // May 15, 2026 REASON: THE CORE BUSINESS RULE
    //   peak_rate = Math.max(liveRate, storedPeak)
    //   Live rate higher  → peak goes up   → customers pay more (price rose)
    //   Live rate lower   → peak stays     → customers still pay the old higher price
    //   USD always = 1 (it's the base — no ratchet needed)
    const upsertRows = SUPPORTED.map((currency) => {
      const liveRate = liveRates[currency]
      // First run (no stored row yet): start peak at live rate
      const storedPeak = storedPeaks[currency] ?? liveRate

      const newPeak = currency === 'USD'
        ? 1
        : Math.max(liveRate, storedPeak)

      return {
        currency,
        rate: liveRate,      // informational — visible in Supabase for admin reference
        peak_rate: newPeak,  // what all prices across the site actually use
        updated_at: new Date().toISOString(),
      }
    })

    // ── 5. Upsert ─────────────────────────────────────────────────────────────
    const { error: upsertError } = await supabaseAdmin
      .from('currency_rates')
      .upsert(upsertRows, { onConflict: 'currency' })

    if (upsertError) throw new Error(`Supabase upsert failed: ${upsertError.message}`)

    const ratcheted = upsertRows
      .filter(r => r.currency !== 'USD' &&
        r.peak_rate > (storedPeaks[r.currency as CurrencyCode] ?? 0))
      .map(r => `${r.currency}: ${storedPeaks[r.currency as CurrencyCode]?.toFixed(4)} → ${r.peak_rate.toFixed(4)}`)

    return NextResponse.json({
      synced: true,
      usedFallback,
      ratcheted: ratcheted.length > 0 ? ratcheted : 'none — no currencies moved up',
      rates: Object.fromEntries(upsertRows.map(r => [r.currency, {
        live: r.rate,
        peak: r.peak_rate,
      }])),
    })

  } catch (err: any) {
    console.error('[currency/sync] error:', err?.message ?? err)
    return NextResponse.json({ synced: false, error: 'Sync failed' }, { status: 500 })
  }
}
