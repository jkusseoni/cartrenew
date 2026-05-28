'use client'

import { useState, useEffect } from 'react'
import { UserButton, useUser } from '@clerk/nextjs'
import { supabaseClient } from '@/lib/supabase'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { RecentCartsTable } from '@/components/dashboard/RecentCartsTable'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'

interface DashboardStats {
  totalCarts: number
  recovered: number
  revenue: number
  recoveryRate: number
  messagesSent: number
  messagesDelivered: number
  messagesRead: number
  pendingCarts: number
}

interface CartItem {
  id: string
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  cart_value: number
  status: string
  items: any[]
  checkout_url: string | null
  created_at: string
  message_sent_at: string | null
  message_read_at: string | null
}

export default function DashboardPage() {
  const { user, isLoaded } = useUser()
  const [stats, setStats] = useState<DashboardStats>({
    totalCarts: 0,
    recovered: 0,
    revenue: 0,
    recoveryRate: 0,
    messagesSent: 0,
    messagesDelivered: 0,
    messagesRead: 0,
    pendingCarts: 0,
  })
  const [carts, setCarts] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded && user) {
      fetchDashboardData()
    }
  }, [isLoaded, user])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Get store
      const { data: store } = await supabaseClient
        .from('stores')
        .select('id')
        .eq('clerk_user_id', user!.id)
        .single()

      if (!store) {
        setLoading(false)
        return
      }

      // Fetch stats from abandoned_carts
      const { data: cartsData } = await supabaseClient
        .from('abandoned_carts')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
        .limit(50)

      // Get analytics for this month
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { data: analyticsData } = await supabaseClient
        .from('analytics_daily')
        .select('*')
        .eq('store_id', store.id)
        .gte('date', startOfMonth.toISOString().split('T')[0])

      // Calculate stats
      const allCarts = cartsData || []
      const recovered = allCarts.filter(c => c.status === 'recovered').length
      const pending = allCarts.filter(c => c.status === 'pending').length
      const revenue = allCarts
        .filter(c => c.status === 'recovered')
        .reduce((sum, c) => sum + (c.cart_value || 0), 0)

      const monthlyAnalytics = analyticsData || []
      const messagesSent = monthlyAnalytics.reduce((s, a) => s + (a.messages_sent || 0), 0)
      const messagesDelivered = monthlyAnalytics.reduce((s, a) => s + (a.messages_delivered || 0), 0)
      const messagesRead = monthlyAnalytics.reduce((s, a) => s + (a.messages_read || 0), 0)

      setStats({
        totalCarts: allCarts.length,
        recovered,
        revenue,
        recoveryRate: allCarts.length > 0 ? Math.round((recovered / allCarts.length) * 100) : 0,
        messagesSent,
        messagesDelivered,
        messagesRead,
        pendingCarts: pending,
      })

      setCarts(allCarts.slice(0, 20).map(c => ({
        id: c.id,
        customer_name: c.customer_name,
        customer_phone: c.customer_phone,
        customer_email: c.customer_email,
        cart_value: c.cart_value,
        status: c.status,
        items: c.items || [],
        checkout_url: c.checkout_url,
        created_at: c.created_at,
        message_sent_at: c.message_sent_at,
        message_read_at: c.message_read_at,
      })))

    } catch (error) {
      console.error('Error fetching dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <DashboardSkeleton />

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">CartRenew</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Dashboard
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 hidden sm:block">
                {user?.emailAddresses[0]?.emailAddress}
              </span>
              <UserButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="mb-8">
          <StatsCards stats={stats} />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <a
              href="/settings"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Connect Shopify & WhatsApp
            </a>
            <a
              href="/analytics"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View Analytics
            </a>
          </div>
        </div>

        {/* Recent Carts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Recent Abandoned Carts</h2>
            <span className="text-sm text-gray-500">{carts.length} carts</span>
          </div>
          <RecentCartsTable carts={carts} onRefresh={fetchDashboardData} />
        </div>
      </main>
    </div>
  )
}