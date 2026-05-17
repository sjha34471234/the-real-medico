'use client'
// ============================================================
// FILE: components/account/OrdersTab.tsx
// PURPOSE: Renders order history — product orders and membership payments.
//   Product orders show a "Track Order" button that fetches Printify status inline.
// LAST CHANGED: May 17, 2026
// WHY IT EXISTS: Extracted from app/account/page.tsx (modular refactor May 17).
// DEPENDENCIES: Supabase anon client, /api/orders/track route
// ⚠️ DO NOT CHANGE: accessToken passed from parent (account/page.tsx owns auth state).
//   Never call supabase.auth.getSession() here — parent owns the session.
// ⚠️ DO NOT CHANGE: Track button only shown for type='product' + status='confirmed'.
//   Never show tracking for membership rows or cancelled orders.
// ============================================================

// --- CHANGE LOG ---
// [May 17, 2026] ADDED: Order tracking via Printify API
// REASON: Users had no way to check fulfillment status after placing an order.
//   "Track Order" button fetches status inline — no page navigation needed.
// --- END CHANGE LOG ---

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

// May 17, 2026 REASON: Module-level singleton — not recreated on every render
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface TrackingInfo {
  status: string
  label: string
  emoji: string
  colour: string
  shipments: {
    carrier: string
    number: string
    url: string | null
    delivered_at: string | null
    shipped_at: string | null
  }[]
  message?: string
}

interface OrdersTabProps {
  userId: string
  accessToken: string | null
}

export default function OrdersTab({ userId, accessToken }: OrdersTabProps) {
  const [orders, setOrders]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // May 17, 2026 REASON: Per-order tracking state — keyed by order ID so multiple
  //   orders can be tracked independently without interfering with each other.
  const [tracking, setTracking]               = useState<Record<string, TrackingInfo | null>>({})
  const [trackingLoading, setTrackingLoading] = useState<Record<string, boolean>>({})

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

  const handleTrack = async (orderId: string) => {
    // Toggle off if already showing
    if (tracking[orderId]) {
      setTracking(prev => ({ ...prev, [orderId]: null }))
      return
    }
    if (!accessToken) return

    setTrackingLoading(prev => ({ ...prev, [orderId]: true }))

    try {
      const res = await fetch(`/api/orders/track?orderId=${orderId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()

      if (!res.ok) {
        setTracking(prev => ({
          ...prev,
          [orderId]: {
            status: 'error',
            label: 'Could not fetch tracking',
            emoji: '⚠️',
            colour: 'text-red-500',
            shipments: [],
            message: data.error ?? 'Please try again later.',
          },
        }))
      } else {
        setTracking(prev => ({ ...prev, [orderId]: data }))
      }
    } catch {
      setTracking(prev => ({
        ...prev,
        [orderId]: {
          status: 'error',
          label: 'Network error',
          emoji: '⚠️',
          colour: 'text-red-500',
          shipments: [],
          message: 'Could not reach the server. Please try again.',
        },
      }))
    }

    setTrackingLoading(prev => ({ ...prev, [orderId]: false }))
  }

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
      {orders.map((order) => {
        const trackInfo      = tracking[order.id]
        const isTrackLoading = trackingLoading[order.id]
        const isProductOrder = order.type !== 'membership'
        const canTrack       = isProductOrder && order.status === 'confirmed'

        return (
          <div key={order.id} className="card p-5">

            {/* ── Order header ── */}
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

              <div className="text-right flex flex-col items-end gap-1">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  order.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                  order.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {order.status}
                </span>
                {isProductOrder && order.total_amount && (
                  <p className="text-sm font-bold text-primary">
                    ${Number(order.total_amount).toFixed(2)}
                  </p>
                )}
                {order.type === 'membership' && order.status !== 'cancelled' && (
                  <p className="text-sm font-bold text-primary">₹415</p>
                )}
              </div>
            </div>

            {/* ── Line items preview ── */}
            {isProductOrder && Array.isArray(order.line_items) && order.line_items.length > 0 && (
              <div className="text-xs text-text-slate mt-1 mb-3">
                {order.line_items.slice(0, 2).map((item: any, i: number) => (
                  <span key={i}>
                    {item.title || item.name}
                    {i < Math.min(order.line_items.length, 2) - 1 ? ', ' : ''}
                  </span>
                ))}
                {order.line_items.length > 2 && (
                  <span> +{order.line_items.length - 2} more</span>
                )}
              </div>
            )}

            {/* ── Track button ── */}
            {canTrack && (
              <button
                onClick={() => handleTrack(order.id)}
                disabled={isTrackLoading}
                className="text-xs text-primary font-semibold hover:underline disabled:opacity-50 transition-colors"
              >
                {isTrackLoading
                  ? '⏳ Fetching status...'
                  : trackInfo
                    ? '▲ Hide tracking'
                    : '📦 Track Order'}
              </button>
            )}

            {/* ── Tracking panel ── */}
            {trackInfo && (
              <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-xl">{trackInfo.emoji}</span>
                  <div>
                    <p className={`font-bold text-sm ${trackInfo.colour}`}>{trackInfo.label}</p>
                    {trackInfo.message && (
                      <p className="text-xs text-text-slate mt-0.5">{trackInfo.message}</p>
                    )}
                  </div>
                </div>

                {/* Shipments */}
                {trackInfo.shipments.length > 0 ? (
                  <div className="space-y-2">
                    {trackInfo.shipments.map((s, i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                        {s.carrier && (
                          <p className="font-semibold text-text-dark">
                            {s.carrier}
                            {s.number && (
                              <span className="text-text-slate font-normal"> · {s.number}</span>
                            )}
                          </p>
                        )}
                        {s.shipped_at && (
                          <p className="text-text-slate">
                            Shipped:{' '}
                            {new Date(s.shipped_at).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </p>
                        )}
                        {s.delivered_at && (
                          <p className="text-green-600 font-semibold">
                            ✅ Delivered:{' '}
                            {new Date(s.delivered_at).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </p>
                        )}
                        {s.url && (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-1 text-primary font-semibold hover:underline"
                          >
                            Track on carrier site →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  trackInfo.status !== 'error' && (
                    <p className="text-xs text-text-slate">
                      Your order is being processed. Tracking details will appear here once it ships.
                    </p>
                  )
                )}
              </div>
            )}

          </div>
        )
      })}
    </div>
  )
}
