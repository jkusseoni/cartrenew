'use client'

import { useState, useEffect } from 'react'
import { UserButton, useUser } from '@clerk/nextjs'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export default function DashboardPage() {
  const { user, isLoaded } = useUser()
  const [stats, setStats] = useState({
    totalCarts: 0,
    recovered: 0,
    revenue: 0,
    pending: 0,
    messagesSent: 0,
    messagesRead: 0,
    deliveryRate: 0,
    recoveryRate: 0,
  })
  const [carts, setCarts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoaded || !user) return

    async function fetchData() {
      try {
        // Get store
        const { data: store } = await supabase
          .from('stores')
          .select('id')
          .eq('clerk_user_id', user.id)
          .single()

        if (!store) {
          setLoading(false)
          return
        }

        // Fetch carts
        const { data: cartsData } = await supabase
          .from('abandoned_carts')
          .select('*')
          .eq('store_id', store.id)
          .order('created_at', { ascending: false })

        const allCarts = cartsData || []
        const recovered = allCarts.filter((c: any) => c.status === 'recovered').length
        const pending = allCarts.filter((c: any) => c.status === 'pending').length
        const revenue = allCarts
          .filter((c: any) => c.status === 'recovered')
          .reduce((sum: number, c: any) => sum + (c.cart_value || 0), 0)

        // Fetch analytics
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        const { data: analyticsData } = await supabase
          .from('analytics_daily')
          .select('*')
          .eq('store_id', store.id)
          .gte('date', startOfMonth.toISOString().split('T')[0])

        const monthly = analyticsData || []
        const sent = monthly.reduce((s: number, a: any) => s + (a.messages_sent || 0), 0)
        const delivered = monthly.reduce((s: number, a: any) => s + (a.messages_delivered || 0), 0)
        const read = monthly.reduce((s: number, a: any) => s + (a.messages_read || 0), 0)

        setStats({
          totalCarts: allCarts.length,
          recovered,
          revenue,
          pending,
          messagesSent: sent,
          messagesRead: read,
          deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
          recoveryRate: allCarts.length > 0 ? Math.round((recovered / allCarts.length) * 100) : 0,
        })

        setCarts(allCarts.slice(0, 10))
      } catch (e) {
        console.error('Dashboard fetch error:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isLoaded, user])

  const statCards = [
    { label: 'Total Carts', value: stats.totalCarts, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Recovered', value: stats.recovered, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Revenue', value: `₹${stats.revenue.toLocaleString('en-IN')}`, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Pending', value: stats.pending, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Messages Sent', value: stats.messagesSent, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Messages Read', value: stats.messagesRead, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Delivery Rate', value: `${stats.deliveryRate}%`, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Recovery Rate', value: `${stats.recoveryRate}%`, color: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    messaged: 'bg-blue-100 text-blue-700',
    delivered: 'bg-cyan-100 text-cyan-700',
    read: 'bg-indigo-100 text-indigo-700',
    recovered: 'bg-green-100 text-green-700',
    lost: 'bg-gray-100 text-gray-700',
    opted_out: 'bg-red-100 text-red-700',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">CartRenew Dashboard</h1>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className={`${card.bg} rounded-xl p-4 border border-gray-100`}>
              <p className="text-sm font-medium text-gray-600">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color} mt-1`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <a href="/settings" className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              Connect Shopify & WhatsApp
            </a>
            <a href="/analytics" className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
              View Analytics
            </a>
          </div>
        </div>

        {/* Carts Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Recent Abandoned Carts</h2>
            <span className="text-sm text-gray-500">{carts.length} total</span>
          </div>

          {carts.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 font-medium">No abandoned carts yet</p>
              <p className="text-gray-400 text-sm mt-1">Connect Shopify to start tracking</p>
              <a href="/settings" className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                Go to Settings
              </a>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left">Customer</th>
                    <th className="px-6 py-3 text-left">Value</th>
                    <th className="px-6 py-3 text-left">Status</th>
                    <th className="px-6 py-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {carts.map((cart: any) => (
                    <tr key={cart.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <p className="font-medium text-gray-900">{cart.customer_name || 'Unknown'}</p>
                        <p className="text-gray-500 text-xs">{cart.customer_phone || 'No phone'}</p>
                      </td>
                      <td className="px-6 py-3 font-semibold">₹{cart.cart_value?.toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[cart.status] || statusColors.pending}`}>
                          {cart.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500">
                        {new Date(cart.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}