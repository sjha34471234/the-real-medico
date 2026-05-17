'use client'
// ============================================================
// FILE: components/checkout/AddressPicker.tsx
// PURPOSE: Saved address selector — renders saved addresses + "new address" option.
//   Used in both Step 1 (contact) and Step 2 (shipping) of checkout.
// LAST CHANGED: May 17, 2026
// WHY IT EXISTS: Extracted from app/checkout/page.tsx as part of modular refactor.
//   Was duplicated verbatim in steps 1 and 2 — now single source of truth.
// DEPENDENCIES: None beyond React
// ⚠️ DO NOT CHANGE: onSelect fills the parent form state — it must set all 7 fields
//   (name, email, phone, address, city, state, zip, country) in one call.
//   Partial updates cause mismatch between step 1 contact fields and step 2 address fields.
// ============================================================

interface Address {
  id: string
  name: string
  email?: string
  phone?: string
  address: string
  city: string
  state?: string
  zip: string
  country?: string
  is_default?: boolean
}

interface AddressPickerProps {
  addresses: Address[]
  selectedId: string | null
  onSelect: (addr: Address | null) => void
  showContactFields?: boolean  // true in step 1 (shows name/email/phone); false in step 2
}

export default function AddressPicker({
  addresses,
  selectedId,
  onSelect,
  showContactFields = false,
}: AddressPickerProps) {
  if (addresses.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-text-dark">
        {showContactFields ? 'Use a saved address' : 'Saved Addresses'}
      </p>
      <div className="space-y-2">
        {addresses.map((addr) => (
          <button
            key={addr.id}
            onClick={() => onSelect(addr)}
            className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm ${
              selectedId === addr.id
                ? 'border-primary bg-primary/5'
                : 'border-slate-200 hover:border-primary'
            }`}
          >
            <p className="font-semibold text-text-dark flex items-center gap-2">
              {addr.name}
              {addr.is_default && (
                <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded-full">Default</span>
              )}
            </p>
            <p className="text-text-slate text-xs mt-0.5">
              {showContactFields && addr.phone && `${addr.phone} · `}
              {addr.address}, {addr.city}
              {addr.state ? `, ${addr.state}` : ''} — {addr.zip}, {addr.country || 'India'}
            </p>
          </button>
        ))}

        {/* "New address" option */}
        <button
          onClick={() => onSelect(null)}
          className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm ${
            selectedId === null
              ? 'border-primary bg-primary/5'
              : 'border-slate-200 hover:border-primary'
          }`}
        >
          <p className="font-semibold text-primary">+ Enter a new address</p>
        </button>
      </div>
      <div className="border-t pt-1 mt-1" />
    </div>
  )
}
