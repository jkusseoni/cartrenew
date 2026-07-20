'use client'

import { useState } from 'react'

interface Cart {
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

interface RecentCartsTableProps {
  carts: Cart[]
  onRefresh: () => void
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: 'text-yellow-700', bg: 'bg-yellow-100', label: 'Pending' },
  messaged: { color: 'text-blue-700', bg: 'bg-blue-100', label: 'Messaged' },
  delivered: { color: 'text-cyan-700', bg: 'bg-cyan-100', label: 'Delivered' },
  read: { color: 'text-indigo-700', bg: 'bg-indigo-100', label: 'Read' },
  recovered: { color: 'text-green-700', bg: 'bg-green-100', label: 'Recovered' },
  lost: { color: 'text-gray-700', bg: 'bg-gray-100', label: 'Lost' },
  opted_out: { color: 'text-red-700', bg: 'bg-red-100', label: 'Opted Out' },
}

export function RecentCartsTable({ carts, onRefresh }: RecentCartsTableProps) {
  const [sendingId, setSendingId] = useState<string | null>(null)

  const sendMessage = async (cartId: string) => {
    setSendingId(cartId)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId }),
      })
      const data = await res.json()
      if (data.success) {
        alert('Message sent successfully!')
        onRefresh()
      } else {
        alert(data.error || 'Failed to send message')
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSendingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (carts.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <p className="text-gray-500 text-lg font-medium">No abandoned carts yet</p>
        <p className="text-gray-400 text-sm mt-1">Connect your Shopify store to start tracking carts</p>
        <a
          href="/settings"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Connect Shopify
        </a>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 text-gray-600 font-medium">
          <tr>
            <th className="px-6 py-4">Customer</th>
            <th className="px-6 py-4">Items</th>
            <th className="px-6 py-4">Value</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4">Date</th>
            <th className="px-6 py-4">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {carts.map((cart) => {
            const statusKey = cart.status?.trim().toLowerCase() || 'pending'
            const status = statusConfig[statusKey] || statusConfig.pending
            const items = Array.isArray(cart.items) ? cart.items : []

            return (
              <tr key={cart.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">
                      {cart.customer_name || 'Unknown'}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {cart.customer_phone || cart.customer_email || 'No contact info'}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-gray-700">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </p>
                  <p className="text-gray-400 text-xs truncate max-w-[200px]">
                    {items.map((i: any) => i.title).join(', ')}
                  </p>
                </td>
                <td className="px-6 py-4 font-semibold text-gray-900">
                  ₹{cart.cart_value?.toLocaleString('en-IN')}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                    {status.label}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {formatDate(cart.created_at)}
                </td>
                <td className="px-6 py-4">
                  {statusKey === 'pending' && cart.customer_phone && (
                    <button
                      onClick={() => sendMessage(cart.id)}
                      disabled={sendingId === cart.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium disabled:opacity-50"
                    >
                      {sendingId === cart.id ? (
                        <>
                          <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          Send WA
                        </>
                      )}
                    </button>
                  )}
                  {statusKey === 'messaged' && (
                    <span className="text-xs text-gray-400">Sent</span>
                  )}
                  {statusKey === 'recovered' && (
                    <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Recovered
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
