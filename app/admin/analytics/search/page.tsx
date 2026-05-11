// ============================================================
// FILE: app/admin/analytics/search/page.tsx
// PURPOSE: Search analytics dashboard — trends, categories, graphs
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Helps admin understand what customers want → design new products
// DEPENDENCIES: /api/admin/analytics/search
// ============================================================

'use client'
import { useState, useEffect } from 'react'
import { RefreshCw, TrendingUp, Search, FileText, Hash } from 'lucide-react'

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface QueryItem { query: string; count: number }
interface TimelineItem { date: string; count: number }

interface AnalyticsData {
  total: number
  unique: number
  zeroResults: number
  trending: QueryItem[]
  alphabetical: Record<string, QueryItem[]>
  phrases: QueryItem[]
  numerical: QueryItem[]
  timeline: TimelineItem[]
  period: string
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'This Week' },
  { value: 'monthly', label: 'This Month' },
  { value: 'yearly', label: 'This Year' },
]

const SECTIONS = [
  { key: 'trending', label: 'Trending', icon: TrendingUp, color: 'bg-primary' },
  { key: 'phrases', label: 'Phrases', icon: FileText, color: 'bg-purple-500' },
  { key: 'numerical', label: 'Contains Numbers', icon: Hash, color: 'bg-amber-500' },
]

// Simple bar chart component
function BarChart({ data, color = 'bg-primary' }: { data: QueryItem[]; color?: string }) {
  if (!data.length) return <p className="text-text-slate text-sm py-4 text-center">No data yet</p>
  const max = Math.max(...data.map(d => d.count))
  return (
    <div className="space-y-2">
      {data.slice(0, 10).map((item, i) => (
        <div key={item.query} className="flex items-center gap-3">
          <span className="text-xs text-text-slate w-4 flex-shrink-0">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-sm font-medium truncate">{item.query}</span>
              <span className="text-xs text-text-slate ml-2 flex-shrink-0">{item.count}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${color} rounded-full transition-all duration-500`}
                style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Timeline chart
function TimelineChart({ data }: { data: TimelineItem[] }) {
  if (!data.length) return <p className="text-text-slate text-sm py-4 text-center">No data yet</p>
  const max = Math.max(...data.map(d => d.count))
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map(item => (
        <div key={item.date} className="flex-1 flex flex-col items-center gap-1 group relative">
          <div
            className="w-full bg-primary rounded-t transition-all duration-300 hover:bg-primary/80"
            style={{ height: `${Math.max(4, (item.count / max) * 80)}px` }}
          />
          {/* Tooltip */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-text-dark text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {item.date.slice(5)}: {item.count}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SearchAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('weekly')
  const [activeSection, setActiveSection] = useState('trending')
  const [activeAlphaLetter, setActiveAlphaLetter] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/analytics/search?period=${period}`)
      const json = await res.json()
      setData(json)
      // Default to first letter
      const letters = Object.keys(json.alphabetical || {}).sort()
      if (letters.length) setActiveAlphaLetter(letters[0])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [period])

  const getSectionData = (): QueryItem[] => {
    if (!data) return []
    switch (activeSection) {
      case 'trending': return data.trending
      case 'phrases': return data.phrases.slice(0, 10)
      case 'numerical': return data.numerical.slice(0, 10)
      default: return []
    }
  }

  const getSectionColor = () => {
    switch (activeSection) {
      case 'trending': return 'bg-primary'
      case 'phrases': return 'bg-purple-500'
      case 'numerical': return 'bg-amber-500'
      default: return 'bg-primary'
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary">Search Analytics</h1>
          <p className="text-text-slate text-sm mt-1">What customers are looking for</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="card p-6 animate-pulse h-24" />
          ))}
        </div>
      ) : !data ? (
        <div className="card p-12 text-center text-text-slate">Failed to load analytics</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-5">
              <p className="text-xs text-text-slate mb-1">Total Searches</p>
              <p className="text-2xl font-bold text-primary">{data.total.toLocaleString()}</p>
            </div>
            <div className="card p-5">
              <p className="text-xs text-text-slate mb-1">Unique Queries</p>
              <p className="text-2xl font-bold text-primary">{data.unique.toLocaleString()}</p>
            </div>
            <div className="card p-5">
              <p className="text-xs text-text-slate mb-1">Zero Results</p>
              <p className="text-2xl font-bold text-red-500">{data.zeroResults.toLocaleString()}</p>
              <p className="text-xs text-text-slate mt-0.5">Product gaps</p>
            </div>
          </div>

          {/* Timeline */}
          {data.timeline.length > 0 && (
            <div className="card p-6">
              <h2 className="font-bold text-text-dark mb-4">Search Volume Over Time</h2>
              <TimelineChart data={data.timeline} />
              <div className="flex justify-between text-xs text-text-slate mt-2">
                <span>{data.timeline[0]?.date.slice(5)}</span>
                <span>{data.timeline[data.timeline.length - 1]?.date.slice(5)}</span>
              </div>
            </div>
          )}

          {/* Section tabs + chart */}
          <div className="card p-6">
            <div className="flex gap-2 mb-6 flex-wrap">
              {SECTIONS.map(s => {
                const Icon = s.icon
                return (
                  <button key={s.key} onClick={() => setActiveSection(s.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      activeSection === s.key ? 'bg-primary text-white' : 'bg-accent text-text-slate hover:text-primary'
                    }`}>
                    <Icon className="w-4 h-4" />
                    {s.label}
                  </button>
                )
              })}
            </div>
            <h3 className="font-bold text-text-dark mb-4">
              Top 10 — {SECTIONS.find(s => s.key === activeSection)?.label}
            </h3>
            <BarChart data={getSectionData()} color={getSectionColor()} />
          </div>

          {/* Alphabetical breakdown */}
          <div className="card p-6">
            <h2 className="font-bold text-text-dark mb-4">Alphabetical Breakdown</h2>
            {Object.keys(data.alphabetical).length === 0 ? (
              <p className="text-text-slate text-sm">No data yet for this period</p>
            ) : (
              <>
                {/* Letter selector */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {Object.keys(data.alphabetical).sort().map(letter => (
                    <button key={letter} onClick={() => setActiveAlphaLetter(letter)}
                      className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                        activeAlphaLetter === letter ? 'bg-primary text-white' : 'bg-accent text-text-dark hover:bg-primary hover:text-white'
                      }`}>
                      {letter}
                    </button>
                  ))}
                </div>
                {/* Selected letter queries */}
                {activeAlphaLetter && data.alphabetical[activeAlphaLetter] && (
                  <BarChart
                    data={data.alphabetical[activeAlphaLetter].sort((a,b) => b.count - a.count).slice(0, 10)}
                    color="bg-green-500"
                  />
                )}
              </>
            )}
          </div>

          {/* Zero results — product gaps */}
          {data.zeroResults > 0 && (
            <div className="card p-6 border-l-4 border-amber-400">
              <h2 className="font-bold text-text-dark mb-2">⚠️ Product Gaps</h2>
              <p className="text-text-slate text-sm mb-4">
                These searches returned zero results — potential new product opportunities.
              </p>
              <p className="text-sm text-text-slate">
                {data.zeroResults} unique quer{data.zeroResults !== 1 ? 'ies' : 'y'} found nothing.
                Check the trending and alphabetical sections above — queries with low result counts indicate gaps.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
