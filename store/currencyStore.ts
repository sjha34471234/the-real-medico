// ============================================================
// FILE: store/currencyStore.ts
// PURPOSE: Currency state — stores selected currency + peak rates from Supabase
// LAST CHANGED: May 15, 2026
// WHY IT EXISTS: Manages currency selection, rate fetching, price formatting
// DEPENDENCIES: Supabase anon key (read-only), zustand persist
// ⚠️ DO NOT CHANGE: Reads peak_rate from Supabase currency_rates table — NOT raw live rates
//   peak_rate is the ratcheted rate (never goes down). Using live rates would break
//   the business rule and cause UI/server price mismatches again.
// ⚠️ DO NOT CHANGE: 1-hour client cache — prevents hammering Supabase on every render
// ⚠️ DO NOT CHANGE: partialize only persists `currency` — rates always re-fetched
//   fresh from Supabase so the ratcheted peak is always current
// ============================================================

// --- CHANGE LOG ---
// [May 15, 2026] CHANGED: Rates now read from Supabase currency_rates.peak_rate
// REASON: Previously fetched raw live rates from open.er-api.com directly.
//   This caused UI/server mismatch (client used live ~95 INR, server used hardcoded 83).
//   Also violated business rule: if INR weakens to 95 then recovers to 85,
//   prices must stay at the 95 peak — not drop back to 85.
//   Now: both client and server read the same peak_rate from Supabase → always match.
// --- END CHANGE LOG ---

'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createClient } from '@supabase/supabase-js'

// May 15, 2026 REASON: Anon key — currency_rates has public read RLS policy
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type CurrencyCode = 'INR' | 'USD' | 'GBP' | 'AED' | 'SGD' | 'MYR' | 'AUD' | 'CAD'

export const CURRENCY_CONFIG: Record<CurrencyCode, { symbol: string; label: string }> = {
  INR: { symbol: '₹',   label: 'INR – Indian Rupee'     },
  USD: { symbol: '$',   label: 'USD – US Dollar'         },
  GBP: { symbol: '£',   label: 'GBP – British Pound'     },
  AED: { symbol: 'د.إ', label: 'AED – UAE Dirham'        },
  SGD: { symbol: 'S$',  label: 'SGD – Singapore Dollar'  },
  MYR: { symbol: 'RM',  label: 'MYR – Malaysian Ringgit' },
  AUD: { symbol: 'A$',  label: 'AUD – Australian Dollar' },
  CAD: { symbol: 'C$',  label: 'CAD – Canadian Dollar'   },
}

// May 15, 2026 REASON: Used ONLY if Supabase is unreachable (last resort).
//   Should roughly match the seeded values in supabase-currency-rates.sql.
const FALLBACK_RATES: Record<CurrencyCode, number> = {
  INR: 95, USD: 1, GBP: 0.79, AED: 3.67,
  SGD: 1.34, MYR: 4.7, AUD: 1.53, CAD: 1.36,
}

const COUNTRY_CURRENCY_MAP: Record<string, CurrencyCode> = {
  IN: 'INR', NP: 'INR', BD: 'INR', LK: 'INR', BT: 'INR', MM: 'INR',
  US: 'USD', CA: 'CAD', GB: 'GBP',
  AE: 'AED', SA: 'AED', QA: 'AED', KW: 'AED', BH: 'AED', OM: 'AED',
  SG: 'SGD', MY: 'MYR', AU: 'AUD', NZ: 'AUD',
}

interface CurrencyState {
  currency: CurrencyCode
  rates: Partial<Record<CurrencyCode, number>>  // peak rates from Supabase
  lastFetched: number | null
  setCurrency: (c: CurrencyCode) => void
  initCurrency: () => Promise<void>
  formatPrice: (usdPrice: number) => string
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      currency: 'INR',
      rates: {},
      lastFetched: null,

      setCurrency: (currency) => set({ currency }),

      initCurrency: async () => {
        const { lastFetched, rates } = get()
        const now = Date.now()
        const oneHour = 60 * 60 * 1000

        // May 15, 2026 REASON: 1-hour client cache — Supabase rates only update
        //   hourly via the sync route, so fetching more often is wasteful.
        const needsFetch =
          !lastFetched ||
          now - lastFetched > oneHour ||
          Object.keys(rates).length === 0

        if (needsFetch) {
          try {
            // May 15, 2026 REASON: peak_rate NOT rate — peak never goes down.
            //   `rate` column is the raw live rate (informational, for admin).
            //   `peak_rate` is what all prices use.
            const { data: rows, error } = await supabase
              .from('currency_rates')
              .select('currency, peak_rate')

            if (error) throw error

            if (rows && rows.length > 0) {
              const newRates: Partial<Record<CurrencyCode, number>> = {}
              for (const row of rows) {
                newRates[row.currency as CurrencyCode] = Number(row.peak_rate)
              }
              newRates['USD'] = 1  // USD always = 1, base currency
              set({ rates: newRates, lastFetched: now })
            } else {
              // Table is empty — SQL not run yet, use fallback
              console.warn('[currencyStore] currency_rates empty — using fallback')
              set({ rates: { ...FALLBACK_RATES }, lastFetched: now })
            }
          } catch (e) {
            console.warn('[currencyStore] Supabase unreachable — using fallback:', e)
            // May 15, 2026 REASON: Only apply fallback if we have no rates at all.
            //   If we already have cached rates from a previous session, keep them
            //   (they're better than fallback). Don't update lastFetched — retry next call.
            if (Object.keys(get().rates).length === 0) {
              set({ rates: { ...FALLBACK_RATES } })
            }
            return
          }
        }

        // ── Auto-detect country for new visitors ─────────────────────────────
        // May 15, 2026 REASON: Only auto-detect if still on default INR.
        //   persist saves currency selection — returning users keep their choice.
        const { currency } = get()
        if (currency === 'INR') {
          try {
            const geoRes = await fetch('https://ipapi.co/json/', { cache: 'no-store' })
            const geoData = await geoRes.json()
            const detected = COUNTRY_CURRENCY_MAP[geoData.country_code as string]
            if (detected) set({ currency: detected })
          } catch {
            // Keep INR — ipapi.co is best-effort
          }
        }
      },

      formatPrice: (usdPrice: number) => {
        const { currency, rates } = get()
        // May 15, 2026 REASON: FALLBACK_RATES guard prevents ₹0 / NaN on first
        //   render before initCurrency has completed and loaded Supabase rates.
        const rate = rates[currency] ?? FALLBACK_RATES[currency] ?? 1
        const converted = usdPrice * rate
        const symbol = CURRENCY_CONFIG[currency].symbol
        const rounded =
          currency === 'INR'
            ? Math.round(converted)
            : parseFloat(converted.toFixed(2))
        return `${symbol}${rounded.toLocaleString()}`
      },
    }),
    {
      name: 'trm-currency',
      // May 15, 2026 REASON: Only persist currency selection — NOT rates or lastFetched.
      //   Persisting rates would mean old peaks survive browser restarts.
      //   We always re-fetch from Supabase on load (1hr client cache in memory only).
      partialize: (s) => ({ currency: s.currency }) as CurrencyState,
    }
  )
)
