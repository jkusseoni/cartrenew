export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabase'

const ANALYTICS_COLUMNS =
  'date,carts_created,messages_sent,messages_delivered,messages_read,carts_recovered,revenue_recovered'

type DailyRow = {
  date: string
  carts_created: number | null
  messages_sent: number | null
  messages_delivered: number | null
  messages_read: number | null
  carts_recovered: number | null
  revenue_recovered: number | null
}

function computeTotals(daily: DailyRow[]) {
  const totals = daily.reduce(
    (acc, day) => ({
      cartsCreated: acc.cartsCreated + (day.carts_created || 0),
      messagesSent: acc.messagesSent + (day.messages_sent || 0),
      messagesDelivered: acc.messagesDelivered + (day.messages_delivered || 0),
      messagesRead: acc.messagesRead + (day.messages_read || 0),
      cartsRecovered: acc.cartsRecovered + (day.carts_recovered || 0),
      revenueRecovered: acc.revenueRecovered + (day.revenue_recovered || 0),
    }),
    {
      cartsCreated: 0,
      messagesSent: 0,
      messagesDelivered: 0,
      messagesRead: 0,
      cartsRecovered: 0,
      revenueRecovered: 0,
    }
  )

  return {
    cartsCreated: totals.cartsCreated,
    messagesSent: totals.messagesSent,
    deliveredRate:
      totals.messagesSent > 0
        ? Math.round((totals.messagesDelivered / totals.messagesSent) * 100)
        : 0,
    readRate:
      totals.messagesSent > 0
        ? Math.round((totals.messagesRead / totals.messagesSent) * 100)
        : 0,
    recoveredRate:
      totals.cartsCreated > 0
        ? Math.round((totals.cartsRecovered / totals.cartsCreated) * 100)
        : 0,
    revenue: totals.revenueRecovered,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const daysParam = request.nextUrl.searchParams.get('days')
    const days = Math.min(Math.max(parseInt(daysParam || '30', 10) || 30, 1), 365)

    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('clerk_user_id', userId)
      .maybeSingle()

    if (storeError) {
      console.error('[api/analytics] store lookup failed:', storeError.message)
      return NextResponse.json({ error: storeError.message }, { status: 500 })
    }

    if (!store) {
      return NextResponse.json({
        daily: [],
        totals: computeTotals([]),
      })
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateIso = startDate.toISOString().split('T')[0]

    const { data, error: analyticsError } = await supabaseAdmin
      .from('analytics_daily')
      .select(ANALYTICS_COLUMNS)
      .eq('store_id', store.id)
      .gte('date', startDateIso)
      .order('date', { ascending: true })

    if (analyticsError) {
      console.error('[api/analytics] daily metrics failed:', analyticsError.message)
      return NextResponse.json({ error: analyticsError.message }, { status: 500 })
    }

    const daily = (data ?? []) as DailyRow[]

    return NextResponse.json({
      daily,
      totals: computeTotals(daily),
    })
  } catch (error) {
    console.error('[api/analytics] unexpected error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
