'use client'

import { useState, useEffect } from 'react'
import { SafeUserButton, useSafeUser } from '@/lib/clerk'
import { getSupabaseClient } from '@/lib/supabase-browser'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { StatsCards } from '@/components/dashboard/StatsCards'

export default function DashboardPage() {
  const { user, isLoaded } = useSafeUser()
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
  const [storeConfigs, setStoreConfigs] = useState<any[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [isRefreshingStores, setIsRefreshingStores] = useState(false)
  const [storeConfigError, setStoreConfigError] = useState<string | null>(null)

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
    loadStoreConfigs()
  }, [isLoaded, user])

  async function loadStoreConfigs() {
    setIsRefreshingStores(true)
    setStoreConfigError(null)
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('stores')
        .select('id, shopify_domain, webhook_ids, clerk_user_id, updated_at')
        .order('updated_at', { ascending: false })

      if (error) {
        throw error
      }

      setStoreConfigs(data || [])
    } catch (error) {
      console.error('Store config load failed:', error)
      setStoreConfigError('Unable to load webhook configurations.')
    } finally {
      setIsRefreshingStores(false)
    }
  }

  async function handleClearWebhooks(storeId: string) {
    setIsRefreshingStores(true)
    setStoreConfigError(null)
    try {
      const response = await fetch('/api/admin/stores/clear-webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storeId }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || 'Failed to clear webhooks')
      }

      await loadStoreConfigs()
    } catch (error) {
      console.error('Clear webhook ids failed:', error)
      setStoreConfigError('Unable to clear webhook configurations.')
    } finally {
      setIsRefreshingStores(false)
    }
  }

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
            <SafeUserButton />
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

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Webhook registration monitor</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Store webhook configurations</h2>
              <p className="mt-3 text-sm text-slate-600 max-w-2xl">
                Review active Shopify webhook IDs for each connected store, refresh the list, and clear webhook registration data when needed.
              </p>
            </div>
            <button
              type="button"
              onClick={loadStoreConfigs}
              disabled={isRefreshingStores}
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshingStores ? 'Refreshing…' : 'Refresh configs'}
            </button>
          </div>

          {storeConfigError && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {storeConfigError}
            </div>
          )}

          <div className="mt-6 space-y-4">
            {storeConfigs.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                No stores found yet. Once your Shopify store is connected, registered webhook IDs will appear here.
              </div>
            ) : (
              storeConfigs.map((store) => {
                const activeWebhooks = Array.isArray(store.webhook_ids) ? store.webhook_ids : []
                const isSelected = selectedStoreId === store.id

                return (
                  <div key={store.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{store.shopify_domain || 'Unknown store'}</p>
                        <p className="mt-1 text-sm text-slate-500">Store ID: {store.id}</p>
                        <p className="mt-1 text-sm text-slate-500">Owner: {store.clerk_user_id || 'N/A'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedStoreId(isSelected ? null : store.id)}
                          className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          {isSelected ? 'Hide details' : 'View details'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClearWebhooks(store.id)}
                          className="rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isRefreshingStores}
                        >
                          Clear webhook configs
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-medium text-slate-600">Active webhook IDs</p>
                      {activeWebhooks.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">No active webhook configurations detected.</p>
                      ) : (
                        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                          {activeWebhooks.map((webhookId: any, index: number) => (
                            <li key={index} className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
                              {typeof webhookId === 'string' ? webhookId : JSON.stringify(webhookId)}
                            </li>
                          ))}
                        </ul>
                      )}
                      {isSelected && (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                          <pre className="whitespace-pre-wrap break-words">{JSON.stringify(store.webhook_ids ?? [], null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

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
