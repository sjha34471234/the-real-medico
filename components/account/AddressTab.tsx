'use client'
// ============================================================
// FILE: components/account/AddressTab.tsx
// PURPOSE: Saved addresses tab — redirects to /account/addresses management page
// LAST CHANGED: May 17, 2026
// WHY IT EXISTS: Extracted from app/account/page.tsx as part of modular refactor.
// DEPENDENCIES: next/link
// ============================================================

import Link from 'next/link'

export default function AddressTab() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Saved Addresses</h2>
        <Link href="/account/addresses" className="btn-primary text-sm py-2 px-4">
          + Manage Addresses
        </Link>
      </div>
      <div className="card p-8 text-center">
        <div className="text-5xl mb-4">📍</div>
        <p className="text-text-slate font-medium mb-2">Manage your saved addresses</p>
        <p className="text-text-slate text-sm mb-4">
          Add, edit or set a default address for faster checkout
        </p>
        <Link href="/account/addresses" className="btn-primary inline-block">
          Go to Addresses
        </Link>
      </div>
    </div>
  )
}
