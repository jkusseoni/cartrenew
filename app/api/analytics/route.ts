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

type AbandonedCartRow = {
  id: string
  customer_name: string | null
  cart_value: number | null
  status: string | null
  created_at: string
  updated_at: string
  items: unknown
}

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

function summarizeItems(items: unknown): string | undefined {
  if (!Array.isArray(items) || items.length === 0) {
    return undefined
  }

  const labels = items
    .slice(0, 2)
    .map((item) => {
      const row = item as { title?: string; name?: string; quantity?: number }
      const label = row.title || row.name || 'item'
      return `${label} (x${row.quantity || 1})`
    })
    .join(', ')

  const suffix = items.length > 2 ? ` +${items.length - 2} more` : ''
  return `${items.length} Item${items.length === 1 ? '' : 's'} (${labels}${suffix})`
}

function mapAbandonedCartRow(row: AbandonedCartRow): LiveFeedItem {
  return {
    id: row.id,
    customerName: row.customer_name || 'Guest',
    cartValue: Number(row.cart_value || 0),
    status: (row.status || 'pending').toUpperCase(),
    createdAt: row.updated_at || row.created_at,
    channel: row.status === 'messaged' ? 'WHATSAPP' : 'WHATSAPP',
    itemsSummary: summarizeItems(row.items),
  }
}

async function fetchLanguageMetrics(userId: string): Promise<LanguageMetric[]> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const merchant = await prisma.merchant.findFirst({
      where: { userId },
      select: { id: true },
    })

    if (!merchant) {
      return []
    }

    const langStats = await prisma.cart.findMany({
      where: { merchantId: merchant.id },
      select: {
        detectedLang: true,
        totalAmount: true,
        status: true,
      },
    })

    if (langStats.length === 0) {
      return []
    }

    const grouped = langStats.reduce<Record<string, LanguageMetric>>(
      (acc: Record<string, LanguageMetric>, cart: { detectedLang: string; totalAmount: number; status: string }) => {
        const lang = cart.detectedLang || 'HINGLISH'
        if (!acc[lang]) {
          acc[lang] = { name: lang, counts: 0, revenue: 0 }
        }
        acc[lang].counts += 1
        if (cart.status === 'RECOVERED') {
          acc[lang].revenue += cart.totalAmount || 0
        }
        return acc
      },
      {}
    )

    return Object.values(grouped)
  } catch (error) {
    console.warn('[api/analytics] language metrics unavailable:', error)
    return []
  }
}

async function fetchPrismaLiveFeed(userId: string): Promise<LiveFeedItem[]> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const merchant = await prisma.merchant.findFirst({
      where: { userId },
      select: { id: true },
    })

    if (!merchant) {
      return []
    }

    const carts = await prisma.cart.findMany({
      where: { merchantId: merchant.id },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        customerName: true,
        totalAmount: true,
        status: true,
        updatedAt: true,
        activeChannel: true,
      },
    })

    return carts.map(
      (cart: {
        id: string
        customerName: string | null
        totalAmount: number
        status: string
        updatedAt: Date
        activeChannel: string
      }) => ({
        id: cart.id,
        customerName: cart.customerName || 'Guest',
        cartValue: cart.totalAmount || 0,
        status: cart.status,
        createdAt: cart.updatedAt.toISOString(),
        channel: cart.activeChannel || 'WHATSAPP',
      })
    )
  } catch (error) {
    console.warn('[api/analytics] prisma live feed unavailable:', error)
    return []
  }
}

async function fetchLiveFeed(storeId: string | null, userId: string): Promise<LiveFeedItem[]> {
  const feed: LiveFeedItem[] = []

  if (storeId) {
    const { data: rawFeed, error: feedError } = await supabaseAdmin
      .from('abandoned_carts')
      .select('id, customer_name, cart_value, status, created_at, updated_at, items')
      .eq('store_id', storeId)
      .order('updated_at', { ascending: false })
      .limit(5)

    if (!feedError && rawFeed) {
      feed.push(...(rawFeed as AbandonedCartRow[]).map(mapAbandonedCartRow))
    }
  }

  const prismaFeed = await fetchPrismaLiveFeed(userId)
  feed.push(...prismaFeed)

  return feed
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5)
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

      if (analyticsError) {
        console.error('[api/analytics] daily metrics failed:', analyticsError.message)
        return NextResponse.json({ error: analyticsError.message }, { status: 500 })
      }

      daily = (analyticsData ?? []) as DailyRow[]
    }

    const calculatedTotals = computeTotals(daily)
    const [languageData, liveFeed] = await Promise.all([
      fetchLanguageMetrics(userId),
      fetchLiveFeed(store?.id ?? null, userId),
    ])

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
      languageData,
      liveFeed,
    })
  } catch (error) {
    console.error('[api/analytics] unexpected error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}