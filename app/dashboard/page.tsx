'use client'

import { useState, useEffect } from 'react'
import { UserButton, useUser } from '@clerk/nextjs'
import { getSupabaseClient } from '@/lib/supabase-browser'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { StatsCards } from '@/components/dashboard/StatsCards'

export default function DashboardPage() {
  const { user, isLoaded } = useUser()
  const [totalCarts, setTotalCarts] = useState(0)
  const [recovered, setRecovered] = useState(0)
  const [revenue, setRevenue] = useState(0)
  const [pending, setPending] = useState(0)
  const [messagesSent, setMessagesSent] = useState(0)
  const [messagesDelivered, setMessagesDelivered] = useState(0)
  const [messagesRead, setMessagesRead] = useState(0)
  const [deliveryRate, setDeliveryRate] = useState(0)
  const [recoveryRate, setRecoveryRate] = useState(0)
  const [hasStore, setHasStore] = useState(false)

  useEffect(() => {
    if (!isLoaded || !user) return

    let supabase: ReturnType<typeof getSupabaseClient>
    try {
      supabase = getSupabaseClient()
    } catch (error) {
      console.error('Supabase client init error:', error)
      return
    }

    async function load() {
      try {
        const userId = user!.id
        const { data: store } = await supabase
          .from('stores')
          .select('id')
          .eq('clerk_user_id', userId)
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
        const recoveredCount = allCarts.filter((c: any) => c.status === 'recovered').length
        const pendingCount = allCarts.filter((c: any) => c.status === 'pending').length
        const recoveredRevenue = allCarts
          .filter((c: any) => c.status === 'recovered')
          .reduce((sum: number, cart: any) => sum + (cart.cart_value || 0), 0)

        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        const { data: analyticsData } = await supabase
          .from('analytics_daily')
          .select('*')
          .eq('store_id', store.id)
          .gte('date', startOfMonth.toISOString().split('T')[0])

        const monthly = analyticsData || []
        const sent = monthly.reduce((sum: number, item: any) => sum + (item.messages_sent || 0), 0)
        const delivered = monthly.reduce((sum: number, item: any) => sum + (item.messages_delivered || 0), 0)
        const read = monthly.reduce((sum: number, item: any) => sum + (item.messages_read || 0), 0)

        setTotalCarts(allCarts.length)
        setRecovered(recoveredCount)
        setRevenue(recoveredRevenue)
        setPending(pendingCount)
        setMessagesSent(sent)
        setMessagesDelivered(delivered)
        setMessagesRead(read)
        setDeliveryRate(sent > 0 ? Math.round((delivered / sent) * 100) : 0)
        setRecoveryRate(allCarts.length > 0 ? Math.round((recoveredCount / allCarts.length) * 100) : 0)
      } catch (error) {
        console.error('Dashboard load error:', error)
      }
    }

    load()
  }, [isLoaded, user])

  if (!isLoaded) {
    return <DashboardSkeleton />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">CartRenew</p>
              <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
            </div>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Welcome back</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900">Ready to recover more carts?</h2>
            <p className="mt-4 text-gray-600 leading-7">
              Keep your store connected and monitor recovery performance with 8 metrics that show how your campaign is performing.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
                <p className="text-sm text-slate-500">Store status</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{hasStore ? 'Connected' : 'Not connected'}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
                <p className="text-sm text-slate-500">Step</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{hasStore ? 'Recovery active' : 'Setup required'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
            <p className="mt-3 text-sm text-gray-500">
              Use the fastest path to connect your store, review analytics, or manage your settings.
            </p>
            <div className="mt-6 grid gap-3">
              <a
                href="/settings"
                className="block rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                {hasStore ? 'Manage Integrations' : 'Connect Shopify & WhatsApp'}
              </a>
              <a
                href="/analytics"
                className="block rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                View Analytics
              </a>
              <a
                href="/dashboard"
                className="block rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Review Recent Carts
              </a>
            </div>
          </div>
        </div>

        <StatsCards
          stats={{
            totalCarts,
            recovered,
            revenue,
            recoveryRate,
            messagesSent,
            messagesDelivered,
            messagesRead,
            pendingCarts: pending,
          }}
        />

        {!hasStore && (
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-blue-900">Welcome to CartRenew!</h3>
            <p className="mt-3 text-sm leading-7 text-blue-800">
              Connect your Shopify store and WhatsApp Business account to start recovering abandoned carts with automated reminders.
            </p>
            <a
              href="/settings"
              className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Start Setup →
            </a>
          </div>
        )}
      </main>
    </div>
  )
}
