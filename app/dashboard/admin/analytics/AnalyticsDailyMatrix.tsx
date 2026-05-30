'use client'

import { useState, useEffect } from 'react'

interface AnalyticsData {
  recoveredToday: number
  recoveryRate: number
  savedRevenue: number
}

export default function AnalyticsDailyMatrix() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true)
        const res = await fetch('/api/admin/analytics/daily-metrics')
        if (!res.ok) throw new Error('Failed to fetch analytics')
        const data = await res.json()
        setAnalytics(data)
      } catch (e: any) {
        console.error('Analytics fetch error:', e)
        setError(e.message || 'Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-medium">Failed to load analytics</p>
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  const cards = [
    {
      label: 'Total Abandoned Carts Recovered Today',
      value: analytics.recoveredToday,
      unit: 'carts',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      icon: (
        <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Recovery Rate',
      value: analytics.recoveryRate,
      unit: '%',
      color: 'text-green-600',
      bg: 'bg-green-50',
      borderColor: 'border-green-200',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      trend: 'up',
    },
    {
      label: 'Total Saved Revenue',
      value: analytics.savedRevenue,
      unit: 'INR',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      borderColor: 'border-blue-200',
      icon: (
        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className={`rounded-lg border ${card.borderColor} ${card.bg} p-6 shadow-sm transition-all hover:shadow-md`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-3">{card.label}</p>
              <div className="flex items-end gap-2">
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl font-bold ${card.color}`}>
                    {card.unit === 'INR' ? `₹${card.value.toLocaleString('en-IN')}` : card.value.toLocaleString()}
                  </span>
                  {card.unit && card.unit !== 'INR' && (
                    <span className={`text-sm font-semibold ${card.color}`}>{card.unit}</span>
                  )}
                </div>
                {card.trend === 'up' && (
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7 14l5-5 5 5" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" />
                    </svg>
                    <span className="text-xs font-semibold text-green-600">Positive</span>
                  </div>
                )}
              </div>
            </div>
            <div className={`${card.bg} rounded-full p-3 flex items-center justify-center`}>{card.icon}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
