'use client'

import { useState, useEffect } from 'react'
import { UserButton, useUser } from '@clerk/nextjs'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export default function DashboardPage() {
  const { user, isLoaded } = useUser()
  const [totalCarts, setTotalCarts] = useState(0)
  const [recovered, setRecovered] = useState(0)
  const [revenue, setRevenue] = useState(0)
  const [pending, setPending] = useState(0)
  const [messagesSent, setMessagesSent] = useState(0)
  const [messagesRead, setMessagesRead] = useState(0)
  const [deliveryRate, setDeliveryRate] = useState(0)
  const [recoveryRate, setRecoveryRate] = useState(0)
  const [hasStore, setHasStore] = useState(false)

  useEffect(() => {
    if (!isLoaded || !user || !supabaseUrl || !supabaseKey) return

    const supabase = createClient(supabaseUrl, supabaseKey)

    async function load() {
      try {
        const { data: store } = await supabase
          .from('stores')
          .select('id')
          .eq('clerk_user_id', user!.id)   // user! add karo
          .single()

        if (!store) {
          setHasStore(false)
          return
        }

        setHasStore(true)

        const { data: cartsData } = await supabase
          .from('abandoned_carts')
          .select('*')
          .eq('store_id', store.id)

        const allCarts = cartsData || []
        const rec = allCarts.filter((c: any) => c.status === 'recovered').length
        const pend = allCarts.filter((c: any) => c.status === 'pending').length
        const rev = allCarts
          .filter((c: any) => c.status === 'recovered')
          .reduce((s: number, c: any) => s + (c.cart_value || 0), 0)

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

        setTotalCarts(allCarts.length)
        setRecovered(rec)
        setRevenue(rev)
        setPending(pend)
        setMessagesSent(sent)
        setMessagesRead(read)
        setDeliveryRate(sent > 0 ? Math.round((delivered / sent) * 100) : 0)
        setRecoveryRate(allCarts.length > 0 ? Math.round((rec / allCarts.length) * 100) : 0)
      } catch (e) {
        console.error(e)
      }
    }

    load()
  }, [isLoaded, user])

  const cards = [
    { label: 'Total Carts', value: totalCarts, c: 'text-blue-600', b: 'bg-blue-50' },
    { label: 'Recovered', value: recovered, c: 'text-green-600', b: 'bg-green-50' },
    { label: 'Revenue', value: `₹${revenue.toLocaleString('en-IN')}`, c: 'text-purple-600', b: 'bg-purple-50' },
    { label: 'Pending', value: pending, c: 'text-yellow-600', b: 'bg-yellow-50' },
    { label: 'Msgs Sent', value: messagesSent, c: 'text-indigo-600', b: 'bg-indigo-50' },
    { label: 'Msgs Read', value: messagesRead, c: 'text-teal-600', b: 'bg-teal-50' },
    { label: 'Delivery %', value: `${deliveryRate}%`, c: 'text-cyan-600', b: 'bg-cyan-50' },
    { label: 'Recovery %', value: `${recoveryRate}%`, c: 'text-orange-600', b: 'bg-orange-50' },
  ]

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">CartRenew Dashboard</h1>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <div key={card.label} className={`${card.b} rounded-xl p-4 border border-gray-100`}>
              <p className="text-sm font-medium text-gray-600">{card.label}</p>
              <p className={`text-2xl font-bold ${card.c} mt-1`}>{card.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <a href="/settings" className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
              {hasStore ? 'Manage Integrations' : 'Connect Shopify & WhatsApp'}
            </a>
            <a href="/analytics" className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">
              View Analytics
            </a>
          </div>
        </div>

        {!hasStore && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Welcome to CartRenew!</h3>
            <p className="text-blue-700 mb-4">
              Get started by connecting your Shopify store and WhatsApp Business account to start recovering abandoned carts.
            </p>
            <a href="/settings" className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
              Start Setup →
            </a>
          </div>
        )}

        {hasStore && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <p className="text-green-700 font-medium">
              ✅ Your store is connected! Cart recovery automation is active.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}