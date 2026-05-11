// ============================================================
// FILE: app/api/admin/analytics/subscriptions/route.ts
// PURPOSE: Aggregate memberships table into subscription analytics
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Admin needs to track membership performance over time
// DEPENDENCIES: SUPABASE_SERVICE_ROLE_KEY, memberships table
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
    default: now.setMonth(now.getMonth() - 1)
  }
  return now.toISOString()
}

export async function GET(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || 'monthly'
  const startDate = getStartDate(period)

  const supabase = getAdminSupabase()

  // Fetch ALL memberships (need full history for totals)
  const { data: allMembers, error } = await supabase
    .from('memberships')
    .select('id, email, active, created_at, cancelled_at')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  if (!allMembers?.length) {
    return NextResponse.json({
      totalActive: 0,
      totalAllTime: 0,
      newInPeriod: 0,
      cancelledInPeriod: 0,
      netGrowth: 0,
      churnRate: 0,
      mrr: 0,
      timeline: [],
      period,
    })
  }

  const now = new Date()
  const periodStart = new Date(startDate)

  // Overall stats
  const totalActive = allMembers.filter(m => m.active).length
  const totalAllTime = allMembers.length
  const newInPeriod = allMembers.filter(m => new Date(m.created_at) >= periodStart).length
  const cancelledInPeriod = allMembers.filter(m =>
    m.cancelled_at && new Date(m.cancelled_at) >= periodStart
  ).length
  const netGrowth = newInPeriod - cancelledInPeriod

  // Churn rate = cancellations / (active at start of period)
  const activeAtStart = allMembers.filter(m =>
    new Date(m.created_at) < periodStart && m.active
  ).length
  const churnRate = activeAtStart > 0
    ? Math.round((cancelledInPeriod / activeAtStart) * 100)
    : 0

  // MRR = active members × ₹415/month
  const mrr = totalActive * 415

  // Timeline — group by day for the period
  const membersInPeriod = allMembers.filter(m => new Date(m.created_at) >= periodStart)
  const cancelledInPeriodList = allMembers.filter(m =>
    m.cancelled_at && new Date(m.cancelled_at) >= periodStart
  )

  // Build day-by-day map
  const timelineMap: Record<string, { new: number; cancelled: number; active: number }> = {}

  // Seed all days in period
  const cursor = new Date(periodStart)
  while (cursor <= now) {
    const key = cursor.toISOString().slice(0, 10)
    timelineMap[key] = { new: 0, cancelled: 0, active: 0 }
    cursor.setDate(cursor.getDate() + 1)
  }

  membersInPeriod.forEach(m => {
    const day = m.created_at.slice(0, 10)
    if (timelineMap[day]) timelineMap[day].new++
  })

  cancelledInPeriodList.forEach(m => {
    if (!m.cancelled_at) return
    const day = m.cancelled_at.slice(0, 10)
    if (timelineMap[day]) timelineMap[day].cancelled++
  })

  // Calculate running active count per day
  let runningActive = allMembers.filter(m =>
    new Date(m.created_at) < periodStart && m.active
  ).length

  const timeline = Object.entries(timelineMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, counts]) => {
      runningActive = runningActive + counts.new - counts.cancelled
      return {
        date,
        new: counts.new,
        cancelled: counts.cancelled,
        active: Math.max(0, runningActive),
      }
    })

  return NextResponse.json({
    totalActive,
    totalAllTime,
    newInPeriod,
    cancelledInPeriod,
    netGrowth,
    churnRate,
    mrr,
    timeline,
    period,
  })
}
