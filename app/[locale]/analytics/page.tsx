"use client";

import { useState, useEffect, useCallback } from 'react'
import { useSafeUser } from '@/lib/clerk'
import { getSupabaseClient } from '@/lib/supabase-browser'

interface DailyAnalytics {
  date: string
  carts_created: number
  messages_sent: number
  messages_delivered: number
  messages_read: number
  carts_recovered: number
  revenue_recovered: number
}

export default function AnalyticsPage() {
  const { user, isLoaded } = useSafeUser()
  const [analytics, setAnalytics] = useState<DailyAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState(30) // days

  const fetchAnalytics = useCallback(async () => {
    if (!user) {
      return
    }

    try {
      setLoading(true)

      const client = getSupabaseClient()
      const { data: store } = await client
        .from('stores')
        .select('id')
        .eq('clerk_user_id', user.id)
        .single()

      if (!store) {
        setLoading(false)
        return
      }

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - dateRange)

      const { data } = await client
        .from('analytics_daily')
        .select('*')
        .eq('store_id', store.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true })

      setAnalytics(data || [])
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }, [dateRange, user])

  useEffect(() => {
    if (isLoaded && user) {
      void fetchAnalytics()
    }
  }, [fetchAnalytics, isLoaded, user])

  // Calculate totals
  const totals = analytics.reduce(
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

  const deliveryRate = totals.messagesSent > 0
    ? Math.round((totals.messagesDelivered / totals.messagesSent) * 100)
    : 0

  const readRate = totals.messagesSent > 0
    ? Math.round((totals.messagesRead / totals.messagesSent) * 100)
    : 0

  const recoveryRate = totals.cartsCreated > 0
    ? Math.round((totals.cartsRecovered / totals.cartsCreated) * 100)
    : 0

  // Simple bar chart component
  const BarChart = ({ data, color }: { data: DailyAnalytics[]; color: string }) => {
    const max = Math.max(...data.map(d => d.carts_created || 0), 1)
    return (
      <div className="flex items-end gap-1 h-40 mt-4">
        {data.map((day, i) => (
          <div
            key={day.date}
            className="flex-1 flex flex-col items-center gap-1 group relative"
          >
            <div
              className={`w-full rounded-t ${color} transition-all hover:opacity-80`}
              style={{ height: `${((day.carts_created || 0) / max) * 100}%` }}
            />
            <span className="text-[10px] text-gray-400 rotate-0">
              {new Date(day.date).getDate()}
            </span>
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
              {day.date}: {day.carts_created} carts
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <a href="/dashboard" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Date Range Filter */}
        <div className="flex gap-2 mb-6">
          {[7, 14, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => setDateRange(days)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === days
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <SummaryCard
            label="Carts Created"
            value={totals.cartsCreated}
            color="text-blue-600"
            bg="bg-blue-50"
          />
          <SummaryCard
            label="Messages Sent"
            value={totals.messagesSent}
            color="text-indigo-600"
            bg="bg-indigo-50"
          />
          <SummaryCard
            label="Delivered"
            value={`${deliveryRate}%`}
            color="text-cyan-600"
            bg="bg-cyan-50"
          />
          <SummaryCard
            label="Read Rate"
            value={`${readRate}%`}
            color="text-teal-600"
            bg="bg-teal-50"
          />
          <SummaryCard
            label="Recovered"
            value={`${recoveryRate}%`}
            color="text-green-600"
            bg="bg-green-50"
          />
          <SummaryCard
            label="Revenue"
            value={`₹${totals.revenueRecovered.toLocaleString('en-IN')}`}
            color="text-purple-600"
            bg="bg-purple-50"
          />
        </div>

        {/* Charts */}
        {analytics.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Carts Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">Abandoned Carts</h3>
              <BarChart data={analytics} color="bg-blue-500" />
            </div>

            {/* Messages Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">Messages Sent</h3>
              <BarChart
                data={analytics.map(d => ({ ...d, carts_created: d.messages_sent }))}
                color="bg-indigo-500"
              />
            </div>

            {/* Recovery Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">Carts Recovered</h3>
              <BarChart
                data={analytics.map(d => ({ ...d, carts_created: d.carts_recovered }))}
                color="bg-green-500"
              />
            </div>

            {/* Revenue Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">Revenue Recovered</h3>
              <BarChart
                data={analytics.map(d => ({ ...d, carts_created: d.revenue_recovered }))}
                color="bg-purple-500"
              />
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg font-medium">No data yet</p>
            <p className="text-gray-400 text-sm mt-1">Connect your store and start tracking</p>
          </div>
        )}

        {/* Detailed Table */}
        {analytics.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Daily Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 font-medium">
                  <tr>
                    <th className="px-6 py-3 text-left">Date</th>
                    <th className="px-6 py-3 text-center">Carts</th>
                    <th className="px-6 py-3 text-center">Messages</th>
                    <th className="px-6 py-3 text-center">Delivered</th>
                    <th className="px-6 py-3 text-center">Read</th>
                    <th className="px-6 py-3 text-center">Recovered</th>
                    <th className="px-6 py-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...analytics].reverse().map((day) => (
                    <tr key={day.date} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-900">
                        {new Date(day.date).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-3 text-center">{day.carts_created || 0}</td>
                      <td className="px-6 py-3 text-center">{day.messages_sent || 0}</td>
                      <td className="px-6 py-3 text-center">{day.messages_delivered || 0}</td>
                      <td className="px-6 py-3 text-center">{day.messages_read || 0}</td>
                      <td className="px-6 py-3 text-center font-medium text-green-600">
                        {day.carts_recovered || 0}
                      </td>
                      <td className="px-6 py-3 text-right font-medium">
                        ₹{(day.revenue_recovered || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  color,
  bg,
}: {
  label: string
  value: string | number
  color: string
  bg: string
}) {
  return (
    <div className={`${bg} rounded-xl p-5`}>
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}