// store/currencyStore.ts
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CurrencyCode = 'INR' | 'USD' | 'GBP' | 'AED' | 'SGD' | 'MYR' | 'AUD' | 'CAD';

export const CURRENCY_CONFIG: Record<CurrencyCode, { symbol: string; label: string }> = {
  INR: { symbol: '₹', label: 'INR – Indian Rupee' },
  USD: { symbol: '$', label: 'USD – US Dollar' },
  GBP: { symbol: '£', label: 'GBP – British Pound' },
  AED: { symbol: 'د.إ', label: 'AED – UAE Dirham' },
  SGD: { symbol: 'S$', label: 'SGD – Singapore Dollar' },
  MYR: { symbol: 'RM', label: 'MYR – Malaysian Ringgit' },
  AUD: { symbol: 'A$', label: 'AUD – Australian Dollar' },
  CAD: { symbol: 'C$', label: 'CAD – Canadian Dollar' },
};

// Map country codes → currency
const COUNTRY_CURRENCY_MAP: Record<string, CurrencyCode> = {
  IN: 'INR', NP: 'INR', BD: 'INR', LK: 'INR', BT: 'INR', MM: 'INR',
  US: 'USD', CA: 'CAD', GB: 'GBP',
  AE: 'AED', SA: 'AED', QA: 'AED', KW: 'AED', BH: 'AED', OM: 'AED',
  SG: 'SGD', MY: 'MYR', AU: 'AUD', NZ: 'AUD',
};

interface CurrencyState {
  currency: CurrencyCode;
  rates: Partial<Record<CurrencyCode, number>>; // rates relative to USD
  lastFetched: number | null;
  setCurrency: (c: CurrencyCode) => void;
  initCurrency: () => Promise<void>;
  formatPrice: (usdPrice: number) => string;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      currency: 'INR',
      rates: {},
      lastFetched: null,

      setCurrency: (currency) => set({ currency }),

      initCurrency: async () => {
        const { lastFetched, rates } = get();
        const now = Date.now();

        // Fetch rates if older than 1 hour or never fetched
        if (!lastFetched || now - lastFetched > 60 * 60 * 1000 || Object.keys(rates).length === 0) {
          try {
            const ratesRes = await fetch('https://open.er-api.com/v6/latest/USD');
            const ratesData = await ratesRes.json();
            if (ratesData.result === 'success') {
              const r = ratesData.rates;
              set({
                rates: {
                  INR: r.INR, USD: 1, GBP: r.GBP, AED: r.AED,
                  SGD: r.SGD, MYR: r.MYR, AUD: r.AUD, CAD: r.CAD,
                },
                lastFetched: now,
              });
            }
          } catch (e) {
            // Fallback rates (approximate as of mid-2025)
            set({
              rates: { INR: 83, USD: 1, GBP: 0.79, AED: 3.67, SGD: 1.34, MYR: 4.7, AUD: 1.53, CAD: 1.36 },
              lastFetched: now,
            });
          }
        }

        // Detect country only if currency was never manually set
        // (persist means returning users keep their choice)
        const { currency } = get();
        if (currency === 'INR') { // default — try to auto-detect
          try {
            const geoRes = await fetch('https://ipapi.co/json/');
            const geoData = await geoRes.json();
            const detected = COUNTRY_CURRENCY_MAP[geoData.country_code as string];
            if (detected) set({ currency: detected });
          } catch (e) {
            // keep INR as default
          }
        }
      },

      formatPrice: (usdPrice: number) => {
        const { currency, rates } = get();
        const rate = rates[currency] ?? 83;
        const converted = usdPrice * rate;
        const symbol = CURRENCY_CONFIG[currency].symbol;

        // Format sensibly per currency
        const rounded = currency === 'INR' ? Math.round(converted) : parseFloat(converted.toFixed(2));
        return `${symbol}${rounded.toLocaleString()}`;
      },
    }),
    {
      name: 'trm-currency', // localStorage key
      partialize: (s) => ({ currency: s.currency }) as CurrencyState,
    }
  )
);
