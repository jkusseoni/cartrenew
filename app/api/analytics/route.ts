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

type LanguageMetric = {
  name: string
  counts: number
  revenue: number
}

type LiveFeedItem = {
  id: string
  customerName: string
  cartValue: number
  status: string
  createdAt: string
  channel: string
  itemsSummary?: string
}

// 🌟 सेफ़ फॉलबैक मॉक डेटा (अगर डेटाबेस कनेक्ट न हो तो फ्रंटएंड को बचाने के लिए)
const FALLBACK_ANALYTICS = {
  daily: [
    { date: "2026-07-01", carts_created: 10, messages_sent: 10, messages_delivered: 9, messages_read: 8, carts_recovered: 3, revenue_recovered: 1500 },
    { date: "2026-07-02", carts_created: 15, messages_sent: 15, messages_delivered: 14, messages_read: 12, carts_recovered: 5, revenue_recovered: 2500 },
    { date: "2026-07-03", carts_created: 12, messages_sent: 12, messages_delivered: 12, messages_read: 10, carts_recovered: 4, revenue_recovered: 1800 },
    { date: "2026-07-04", carts_created: 20, messages_sent: 20, messages_delivered: 19, messages_read: 15, carts_recovered: 8, revenue_recovered: 4200 },
  ],
  totals: {
    totalAbandoned: 57,
    messagesSent: 57,
    recoveredRevenue: 10000,
    recoveredRate: 35,
    deliveredRate: 95,
    readRate: 80,
  },
  languageData: [
    { name: "HINGLISH", counts: 32, revenue: 6500 },
    { name: "ENGLISH", counts: 25, revenue: 3500 }
  ],
  liveFeed: [
    { id: "1", customerName: "Rahul Sharma", cartValue: 2400, status: "RECOVERED", createdAt: new Date().toISOString(), channel: "WHATSAPP", itemsSummary: "1 Item (Premium Plan x1)" },
    { id: "2", customerName: "Ananya Iyer", cartValue: 1500, status: "MESSAGED", createdAt: new Date().toISOString(), channel: "WHATSAPP", itemsSummary: "2 Items (Shoes x1...)" }
  ]
};

function computeTotals(daily: DailyRow[]) {
  const totals = daily.reduce(
    (acc, day) => ({
      cartsCreated: acc.cartsCreated + (day.carts_created || 0),
      messagesSent: acc.messagesSent + (day.messages_sent || 0),
      messagesDelivered: acc.messagesDelivered + (day.messages_delivered || 0),
      messagesRead: acc.messagesRead + (day.messages_read || 0),
      cartsRecovered: acc.cartsRecovered + (day.carts_recovered || 0),
      revenueRecovered: acc.revenueRecovered + Number(day.revenue_recovered || 0),
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
    deliveredRate: totals.messagesSent > 0 ? Math.round((totals.messagesDelivered / totals.messagesSent) * 100) : 0,
    readRate: totals.messagesSent > 0 ? Math.round((totals.messagesRead / totals.messagesSent) * 100) : 0,
    recoveredRate: totals.cartsCreated > 0 ? Math.round((totals.cartsRecovered / totals.cartsCreated) * 100) : 0,
    revenue: totals.revenueRecovered,
  }
}

export async function GET(request: NextRequest) {
  try {
    const skipClerk =
      process.env.NODE_ENV === 'development' ||
      process.env.SKIP_CLERK === 'true' ||
      process.env.NEXT_PUBLIC_SKIP_CLERK === 'true'

    let userId: string | null = null

    if (skipClerk) {
      // proxy.ts skips clerkMiddleware in local/dev — auth() would throw.
      userId = 'local-dev'
    } else {
      try {
        const session = await auth()
        userId = session.userId
      } catch (authError) {
        console.warn('[api/analytics] auth() unavailable:', authError)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const daysParam = request.nextUrl.searchParams.get('days')
    const days = Math.min(Math.max(parseInt(daysParam || '30', 10) || 30, 1), 365)

    try {
      const { data: store, error: storeError } = await supabaseAdmin
        .from('stores')
        .select('id')
        .eq('clerk_user_id', userId)
        .maybeSingle()

      if (storeError) throw new Error(storeError.message)

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      const startDateIso = startDate.toISOString().split('T')[0]

      let daily: DailyRow[] = []

      if (store?.id) {
        const { data: analyticsData, error: analyticsError } = await supabaseAdmin
          .from('analytics_daily')
          .select(ANALYTICS_COLUMNS)
          .eq('store_id', store.id)
          .gte('date', startDateIso)
          .order('date', { ascending: true })

        if (analyticsError) throw new Error(analyticsError.message)
        daily = (analyticsData ?? []) as DailyRow[]
      }

      if (daily.length > 0) {
        const calculatedTotals = computeTotals(daily)
        return NextResponse.json({
          daily,
          totals: {
            totalAbandoned: calculatedTotals.cartsCreated,
            messagesSent: calculatedTotals.messagesSent,
            recoveredRevenue: calculatedTotals.revenue,
            recoveredRate: calculatedTotals.recoveredRate,
            deliveredRate: calculatedTotals.deliveredRate,
            readRate: calculatedTotals.readRate,
          },
          languageData: [] as LanguageMetric[],
          liveFeed: [] as LiveFeedItem[],
        })
      }

      // Connected store with empty analytics_daily — still return a structured empty payload.
      if (store?.id) {
        return NextResponse.json({
          daily: [],
          totals: {
            totalAbandoned: 0,
            messagesSent: 0,
            recoveredRevenue: 0,
            recoveredRate: 0,
            deliveredRate: 0,
            readRate: 0,
          },
          languageData: [],
          liveFeed: [],
          storeConnected: true,
        })
      }
    } catch (dbError) {
      console.warn('[api/analytics] Database query failed, using safe fallback:', dbError)
    }

    // No store / DB error: demo fallback so local UI stays interactive.
    return NextResponse.json({ ...FALLBACK_ANALYTICS, storeConnected: false }, { status: 200 })
  } catch (error) {
    console.error('[api/analytics] Unexpected critical error:', error)
    return NextResponse.json({ ...FALLBACK_ANALYTICS, storeConnected: false }, { status: 200 })
  }
}