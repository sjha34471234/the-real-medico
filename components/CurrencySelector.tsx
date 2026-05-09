// components/CurrencySelector.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCurrencyStore, CURRENCY_CONFIG, CurrencyCode } from '@/store/currencyStore';

interface Props {
  variant?: 'navbar' | 'checkout'; // checkout variant is slightly larger
}

export default function CurrencySelector({ variant = 'navbar' }: Props) {
  const { currency, setCurrency } = useCurrencyStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isCheckout = variant === 'checkout';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Select currency"
        className={`flex items-center gap-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50 transition-colors font-medium text-gray-700
          ${isCheckout ? 'px-3 py-2 text-sm' : 'px-2 py-1 text-xs'}`}
      >
        <span>{CURRENCY_CONFIG[currency].symbol}</span>
        <span>{currency}</span>
        <ChevronDown size={isCheckout ? 14 : 12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden
          ${isCheckout ? 'right-0 w-56' : 'right-0 w-52'}`}>
          {(Object.keys(CURRENCY_CONFIG) as CurrencyCode[]).map((code) => (
            <button
              key={code}
              onClick={() => { setCurrency(code); setOpen(false); }}
              aria-label={`Switch to ${CURRENCY_CONFIG[code].label}`}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2
                ${currency === code ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700'}`}
            >
              <span className="w-6 text-center font-medium">{CURRENCY_CONFIG[code].symbol}</span>
              <span>{CURRENCY_CONFIG[code].label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
