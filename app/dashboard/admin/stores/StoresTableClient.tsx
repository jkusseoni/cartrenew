'use client'

import { useState, useEffect } from 'react'

type StoreRow = {
  id: string
  shopify_domain: string
  webhook_ids: any[] | null
  clerk_user_id: string | null
  whatsapp_phone_id: string | null
  updated_at: string
}

export default function StoresTableClient({ initialStores }: { initialStores: StoreRow[] }) {
  const [stores, setStores] = useState<StoreRow[]>(initialStores || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function fetchStores() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/stores')
      if (!res.ok) throw new Error('Failed to fetch stores')
      const json = await res.json()
      setStores(json.stores || [])
    } catch (e: any) {
      setError(e.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // no-op; server provided initialStores
  }, [])

  async function handleClear(storeId: string) {
    if (!confirm('Clear webhook metadata for this store? This cannot be undone.')) return
    setBusyId(storeId)
    try {
      const res = await fetch('/api/admin/stores/clear-webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId }),
      })
      if (!res.ok) throw new Error('Failed to clear webhooks')
      await fetchStores()
    } catch (e: any) {
      setError(e.message || 'Clear failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Registered Stores</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStores}
            className="rounded-2xl bg-white border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-sm text-slate-500">
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3">Webhooks</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="mt-2">
            {stores.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-slate-900">{s.shopify_domain || '—'}</div>
                  <div className="text-xs text-slate-500">{s.updated_at}</div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{s.clerk_user_id || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{s.whatsapp_phone_id || '—'}</td>
                <td className="px-4 py-3">
                  {Array.isArray(s.webhook_ids) && s.webhook_ids.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {s.webhook_ids.map((id: any, i: number) => (
                        <li key={i} className="rounded-2xl bg-slate-100 px-2 py-1 text-xs text-slate-700">{typeof id === 'string' ? id : JSON.stringify(id)}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-slate-500">No webhooks</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchStores()}
                      className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleClear(s.id)}
                      disabled={busyId === s.id}
                      className="rounded-2xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {busyId === s.id ? 'Clearing…' : 'Clear webhooks'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
