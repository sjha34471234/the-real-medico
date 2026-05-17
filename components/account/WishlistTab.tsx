'use client'
// ============================================================
// FILE: components/account/WishlistTab.tsx
// PURPOSE: Renders user wishlist with remove and shop links
// LAST CHANGED: May 17, 2026
// WHY IT EXISTS: Extracted from app/account/page.tsx as part of modular refactor.
//   Logic is identical — only moved to own file.
// DEPENDENCIES: currencyStore (formatPrice), Supabase anon client, react-hot-toast
// ============================================================

import { useState, useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@supabase/supabase-js'
import { useCurrencyStore } from '@/store/currencyStore'

// May 17, 2026 REASON: Module-level singleton — not recreated on every render
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface WishlistTabProps {
  userId: string
}

export default function WishlistTab({ userId }: WishlistTabProps) {
  const [items, setItems]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { formatPrice } = useCurrencyStore()

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('wishlist')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (data) setItems(data)
      setLoading(false)
    }
    load()
  }, [userId])

  const remove = async (productId: string) => {
    await supabase.from('wishlist').delete().eq('user_id', userId).eq('product_id', productId)
    setItems(prev => prev.filter(i => i.product_id !== productId))
    toast.success('Removed from wishlist')
  }

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="card animate-pulse">
          <div className="w-full h-40 bg-slate-200 rounded-t-2xl" />
          <div className="p-4 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-3/4" />
            <div className="h-4 bg-slate-200 rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )

  if (items.length === 0) return (
    <div className="card p-12 text-center">
      <div className="text-5xl mb-4">❤️</div>
      <p className="text-text-slate font-medium mb-2">Your wishlist is empty</p>
      <p className="text-text-slate text-sm mb-4">Tap the heart on any product to save it here</p>
      <Link href="/shop" className="btn-primary inline-block">Browse Products</Link>
    </div>
  )

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">My Wishlist ({items.length})</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {items.map(item => (
          <div key={item.id} className="card">
            <img
              src={item.product_image}
              alt={item.product_title}
              className="w-full h-40 object-cover rounded-t-2xl"
            />
            <div className="p-4">
              <p className="font-semibold text-sm line-clamp-1 mb-1">{item.product_title}</p>
              <p className="text-primary font-bold mb-3">{formatPrice(item.product_price)}</p>
              <div className="flex gap-2">
                <Link
                  href={`/shop/${item.product_id}`}
                  className="btn-primary text-xs py-2 flex-1 text-center"
                >
                  View Product
                </Link>
                <button
                  onClick={() => remove(item.product_id)}
                  aria-label="Remove from wishlist"
                  className="btn-secondary text-xs py-2 px-3"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
