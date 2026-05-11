// ============================================================
// FILE: app/api/admin/analytics/search/route.ts
// PURPOSE: Aggregate search_logs into analytics categories
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Admin needs search insights to design new products
// DEPENDENCIES: SUPABASE_SERVICE_ROLE_KEY, search_logs table
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verifyAdmin(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return false
  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!)
    await jwtVerify(token, secret)
    return true
  } catch { return false }
}

function getStartDate(period: string): string {
  const now = new Date()
  switch (period) {
    case 'daily': now.setHours(0,0,0,0); break
    case 'weekly': now.setDate(now.getDate() - 7); break
    case 'monthly': now.setMonth(now.getMonth() - 1); break
    case 'yearly': now.setFullYear(now.getFullYear() - 1); break
    default: now.setDate(now.getDate() - 7)
  }
  return now.toISOString()
}

function categorize(queries: { query: string; count: number }[]) {
  const alphabetical: Record<string, { query: string; count: number }[]> = {}
  const phrases: { query: string; count: number }[] = []
  const numerical: { query: string; count: number }[] = []

  queries.forEach(item => {
    const q = item.query
    // Phrases = 2+ words
    if (q.split(' ').filter(Boolean).length >= 2) {
      phrases.push(item)
    }
    // Contains numbers
    if (/\d/.test(q)) {
      numerical.push(item)
    }
    // Alphabetical grouping
    const letter = q[0]?.toUpperCase() || '#'
    const key = /[A-Z]/.test(letter) ? letter : '#'
    if (!alphabetical[key]) alphabetical[key] = []
    alphabetical[key].push(item)
  })

  return { alphabetical, phrases, numerical }
}

export async function GET(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || 'weekly'
  const startDate = getStartDate(period)

  const supabase = getAdminSupabase()

  // Fetch all logs in period
  const { data: logs, error } = await supabase
    .from('search_logs')
    .select('query, result_count, created_at')
    .gte('created_at', startDate)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })

  if (!logs || logs.length === 0) {
    return NextResponse.json({
      total: 0,
      unique: 0,
      zeroResults: 0,
      trending: [],
      alphabetical: {},
      phrases: [],
      numerical: [],
      timeline: [],
      period,
    })
  }

  // Aggregate query counts
  const countMap: Record<string, number> = {}
  const zeroResultQueries = new Set<string>()

  logs.forEach(log => {
    const q = log.query.toLowerCase().trim()
    countMap[q] = (countMap[q] || 0) + 1
    if (log.result_count === 0) zeroResultQueries.add(q)
  })

  const queryList = Object.entries(countMap)
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)

  // Top 10 trending
  const trending = queryList.slice(0, 10)

  // Categorize
  const { alphabetical, phrases, numerical } = categorize(queryList)

  // Timeline — group by day
  const timelineMap: Record<string, number> = {}
  logs.forEach(log => {
    const day = log.created_at.slice(0, 10) // YYYY-MM-DD
    timelineMap[day] = (timelineMap[day] || 0) + 1
  })
  const timeline = Object.entries(timelineMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    total: logs.length,
    unique: queryList.length,
    zeroResults: zeroResultQueries.size,
    trending,
    alphabetical,
    phrases: phrases.sort((a, b) => b.count - a.count).slice(0, 50),
    numerical: numerical.sort((a, b) => b.count - a.count).slice(0, 50),
    timeline,
    period,
  })
}
