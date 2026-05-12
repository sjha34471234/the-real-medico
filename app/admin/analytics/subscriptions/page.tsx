// ============================================================
// FILE: app/admin/analytics/subscriptions/page.tsx
// PURPOSE: Subscription analytics — active, new, cancellations, net growth graphs
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Admin needs to track Real Medico+ membership performance
// DEPENDENCIES: /api/admin/analytics/subscriptions
// ============================================================

'use client'
import { useState, useEffect } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Users, DollarSign } from 'lucide-react'

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'
type GraphKey = 'active' | 'new' | 'cancelled' | 'net'

interface TimelineItem {
  date: string
  new: number
  cancelled: number
  active: number
}

interface AnalyticsData {
  totalActive: number
  totalAllTime: number
  newInPeriod: number
  cancelledInPeriod: number
  netGrowth: number
  churnRate: number
  mrr: number
  timeline: TimelineItem[]
  period: string
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'This Week' },
  { value: 'monthly', label: 'This Month' },
  { value: 'yearly', label: 'This Year' },
]

const GRAPHS: { key: GraphKey; label: string; color: string; bgColor: string }[] = [
  { key: 'active', label: 'Active Members', color: '#1A3A8F', bgColor: 'bg-primary' },
  { key: 'new', label: 'New Subscriptions', color: '#16a34a', bgColor: 'bg-green-600' },
  { key: 'cancelled', label: 'Cancellations', color: '#dc2626', bgColor: 'bg-red-600' },
  { key: 'net', label: 'Net Growth', color: '#9333ea', bgColor: 'bg-purple-600' },
]

function MultiLineChart({
  data,
  activeGraphs,
}: {
  data: TimelineItem[]
  activeGraphs: Set<GraphKey>
}) {
  if (!data.length) return (
    <div className="h-48 flex items-center justify-center text-text-slate text-sm">
      No data for this period
    </div>
  )

  const getValue = (item: TimelineItem, key: GraphKey) => {
    switch (key) {
      case 'active': return item.active
      case 'new': return item.new
      case 'cancelled': return item.cancelled
      case 'net': return item.new - item.cancelled
    }
  }

  const allValues = data.flatMap(item =>
    GRAPHS.filter(g => activeGraphs.has(g.key)).map(g => getValue(item, g.key))
  )
  const maxVal = Math.max(...allValues, 1)
  const minVal = Math.min(...allValues, 0)
  const range = maxVal - minVal || 1

  const chartH = 160
  const chartW = 100 // percent-based

  const getY = (val: number) => chartH - ((val - minVal) / range) * chartH

  return (
    <div className="relative">
      {/* Y axis labels */}
      <div className="absolute left-0 top-0 h-40 flex flex-col justify-between text-xs text-text-slate w-8">
        <span>{maxVal}</span>
        <span>{Math.round((maxVal + minVal) / 2)}</span>
        <span>{minVal}</span>
      </div>

      <div className="ml-10 overflow-x-auto">
        <svg
          viewBox={`0 0 ${Math.max(data.length * 20, 300)} ${chartH + 20}`}
          className="w-full"
          style={{ minHeight: '180px' }}
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(pct => (
            <line
              key={pct}
              x1="0" y1={getY(minVal + range * pct)}
              x2={Math.max(data.length * 20, 300)} y2={getY(minVal + range * pct)}
              stroke="#e2e8f0" strokeWidth="1"
            />
          ))}

          {/* Zero line */}
          {minVal < 0 && (
            <line
              x1="0" y1={getY(0)}
              x2={Math.max(data.length * 20, 300)} y2={getY(0)}
              stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4"
            />
          )}

          {/* Lines per graph */}
          {GRAPHS.filter(g => activeGraphs.has(g.key)).map(graph => {
            const points = data.map((item, i) => {
              const x = data.length === 1 ? 150 : (i / (data.length - 1)) * Math.max(data.length * 20, 300)
              const y = getY(getValue(item, graph.key))
              return `${x},${y}`
            }).join(' ')

            return (
              <g key={graph.key}>
                <polyline
                  points={points}
                  fill="none"
                  stroke={graph.color}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {data.map((item, i) => {
                  const x = data.length === 1 ? 150 : (i / (data.length - 1)) * Math.max(data.length * 20, 300)
                  const y = getY(getValue(item, graph.key))
                  return (
                    <circle
                      key={i} cx={x} cy={y} r="3"
                      fill={graph.color}
                      className="cursor-pointer"
                    >
                      <title>{item.date}: {getValue(item, graph.key)}</title>
                    </circle>
                  )
                })}
              </g>
            )
          })}
        </svg>

        {/* X axis labels — show only a few */}
        <div className="flex justify-between text-xs text-text-slate mt-1 px-1">
          <span>{data[0]?.date.slice(5)}</span>
          {data.length > 4 && <span>{data[Math.floor(data.length / 2)]?.date.slice(5)}</span>}
          <span>{data[data.length - 1]?.date.slice(5)}</span>
        </div>
      </div>
    </div>
  )
}

export default function SubscriptionAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('monthly')
  const [activeGraphs, setActiveGraphs] = useState<Set<GraphKey>>(
    new Set(['active', 'new', 'cancelled', 'net'])
  )

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/analytics/subscriptions?period=${period}`)
      const json = await res.json()
      setData(json)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [period])

  const toggleGraph = (key: GraphKey) => {
    setActiveGraphs(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size > 1) next.delete(key) // Keep at least 1
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary">Subscription Analytics</h1>
          <p className="text-text-slate text-sm mt-1">Real Medico+ membership performance</p>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="btn-secondary text-sm py-2 px-4 flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 flex-wrap">
        {PERIODS.map(p => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              period === p.value ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-text-slate hover:border-primary hover:text-primary'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="card p-6 animate-pulse h-24" />)}
        </div>
      ) : !data ? (
        <div className="card p-12 text-center text-text-slate">Failed to load analytics</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-primary" />
                <p className="text-xs text-text-slate">Active Members</p>
              </div>
              <p className="text-2xl font-bold text-primary">{data.totalActive}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <p className="text-xs text-text-slate">New This Period</p>
              </div>
              <p className="text-2xl font-bold text-green-600">+{data.newInPeriod}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <p className="text-xs text-text-slate">Cancelled</p>
              </div>
              <p className="text-2xl font-bold text-red-500">{data.cancelledInPeriod}</p>
              <p className="text-xs text-text-slate mt-0.5">Churn: {data.churnRate}%</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-amber-600" />
                <p className="text-xs text-text-slate">MRR</p>
              </div>
              <p className="text-2xl font-bold text-amber-600">₹{data.mrr.toLocaleString()}</p>
              <p className="text-xs text-text-slate mt-0.5">₹415 × {data.totalActive}</p>
            </div>
          </div>

          {/* Net growth card */}
          <div className={`card p-5 border-l-4 ${data.netGrowth >= 0 ? 'border-green-500' : 'border-red-500'}`}>
            <p className="text-sm text-text-slate mb-1">Net Growth This Period</p>
            <p className={`text-3xl font-bold ${data.netGrowth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {data.netGrowth >= 0 ? '+' : ''}{data.netGrowth} members
            </p>
            <p className="text-xs text-text-slate mt-1">
              {data.newInPeriod} new − {data.cancelledInPeriod} cancelled
            </p>
          </div>

          {/* Chart with graph toggles */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="font-bold text-text-dark">Membership Over Time</h2>
              {/* Graph toggles */}
              <div className="flex flex-wrap gap-2">
                {GRAPHS.map(g => (
                  <button
                    key={g.key}
                    onClick={() => toggleGraph(g.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                      activeGraphs.has(g.key)
                        ? `${g.bgColor} text-white border-transparent`
                        : 'bg-white text-text-slate border-slate-200 hover:border-primary'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeGraphs.has(g.key) ? 'white' : g.color }} />
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            <MultiLineChart data={data.timeline} activeGraphs={activeGraphs} />
          </div>

          {/* All-time stat */}
          <div className="card p-5 text-center">
            <p className="text-text-slate text-sm">All-time members</p>
            <p className="text-3xl font-bold text-primary mt-1">{data.totalAllTime}</p>
            <p className="text-xs text-text-slate mt-1">
              {data.totalActive} currently active ({data.totalAllTime > 0 ? Math.round((data.totalActive / data.totalAllTime) * 100) : 0}% retention)
            </p>
          </div>
        </>
      )}
    </div>
  )
}
