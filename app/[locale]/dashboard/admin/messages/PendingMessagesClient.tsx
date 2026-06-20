'use client'

import { useEffect, useState } from 'react'

type PendingMessage = {
  id: string
  cart_id: string
  store_id: string
  phone: string
  template_name: string
  status: string
  attempt_count: number
  next_retry_at: string | null
  error_message: string | null
  created_at: string
  store: {
    id: string
    shopify_domain: string | null
  } | null
}

export default function PendingMessagesClient() {
  const [messages, setMessages] = useState<PendingMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadMessages() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/messages/pending')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load messages')
      setMessages(json.messages || [])
    } catch (err: any) {
      setError(err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMessages()
  }, [])

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Retry queue</p>
          <h2 className="text-xl font-semibold text-slate-900">Pending message retries</h2>
        </div>
        <button
          onClick={loadMessages}
          className="rounded-2xl bg-white border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left border-collapse">
          <thead>
            <tr className="text-sm text-slate-500">
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Attempts</th>
              <th className="px-4 py-3">Next retry</th>
              <th className="px-4 py-3">Error</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  Loading pending messages...
                </td>
              </tr>
            ) : messages.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  No queued retry messages found.
                </td>
              </tr>
            ) : (
              messages.map((message) => (
                <tr key={message.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <div className="font-medium">{message.store?.shopify_domain || message.store_id}</div>
                    <div className="text-xs text-slate-500">{message.store?.id || message.store_id}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{message.phone}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{message.status}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{message.attempt_count}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {message.next_retry_at ? new Date(message.next_retry_at).toLocaleString() : 'Immediate'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {message.error_message ? <span className="text-rose-600">{message.error_message}</span> : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
