'use client'
// ============================================================
// FILE: components/account/OrdersTab.tsx
// PURPOSE: Renders order history — product orders and membership payments
// LAST CHANGED: May 17, 2026
// WHY IT EXISTS: Extracted from app/account/page.tsx as part of modular refactor.
//   Logic is identical — only moved to own file.
// DEPENDENCIES: Supabase anon client (passed via prop or shared instance)
// ⚠️ DO NOT CHANGE: Shows both type='product' and type='membership' orders.
//   membership_month is only set on membership rows — don't render it on product rows.
// ============================================================

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

// May 17, 2026 REASON: Module-level singleton — not recreated on every render
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface OrdersTabProps {
  userId: string
}

export default function OrdersTab({ userId }: OrdersTabProps) {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setOrders(data)
      setLoading(false)
    }
    load()
  }, [userId])

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="card p-4 animate-pulse h-20" />
      ))}
    </div>
  )

  if (orders.length === 0) return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Order History</h2>
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📦</div>
        <p className="text-text-slate font-medium mb-2">No orders yet</p>
        <p className="text-text-slate text-sm mb-6">Your orders and membership payments will appear here</p>
        <Link href="/shop" className="btn-primary inline-block">Start Shopping</Link>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Order History ({orders.length})</h2>
      {orders.map((order) => (
        <div key={order.id} className="card p-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              {order.type === 'membership' ? (
                <div className="flex items-center gap-2">
                  <span className="text-lg">⭐</span>
                  <span className="font-semibold text-text-dark">
                    Real Medico+ {order.status === 'cancelled'
                      ? 'Cancelled'
                      : `— Month ${order.membership_month || 1}`}
                  </span>
                </div>
              ) : (
                <span className="font-semibold text-text-dark">
                  Order #{order.id?.slice(0, 8).toUpperCase()}
                </span>
              )}
              <p className="text-xs text-text-slate mt-0.5">
                {new Date(order.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            </div>
            <div className="text-right">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                order.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                order.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                'bg-slate-100 text-slate-600'
              }`}>
                {order.status}
              </span>
              {order.type !== 'membership' && order.total_amount && (
                <p className="text-sm font-bold text-primary mt-1">
                  ${Number(order.total_amount).toFixed(2)}
                </p>
              )}
              {order.type === 'membership' && order.status !== 'cancelled' && (
                <p className="text-sm font-bold text-primary mt-1">₹415</p>
              )}
            </div>
          </div>
          {order.type !== 'membership' && Array.isArray(order.line_items) && order.line_items.length > 0 && (
            <div className="text-xs text-text-slate mt-2">
              {order.line_items.slice(0, 2).map((item: any, i: number) => (
                <span key={i}>
                  {item.title || item.name}
                  {i < Math.min(order.line_items.length, 2) - 1 ? ', ' : ''}
                </span>
              ))}
              {order.line_items.length > 2 && <span> +{order.line_items.length - 2} more</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
