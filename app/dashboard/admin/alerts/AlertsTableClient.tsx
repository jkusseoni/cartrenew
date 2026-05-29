'use client'

import { useState } from 'react'

type Alert = {
  id: string
  created_at: string
  level: string
  source: string
  event_type: string
  payload: any
  acknowledged?: boolean
}

type Props = {
  initialAlerts: Alert[]
}

export default function AlertsTableClient({ initialAlerts }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts)
  const [busyId, setBusyId] = useState<string | null>(null)

  const updateAlert = async (id: string, path: string) => {
    setBusyId(id)
    try {
      const response = await fetch(`/api/alerts/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Request failed')
      }

      if (path === 'acknowledge') {
        setAlerts((current) =>
          current.map((alert) =>
            alert.id === id ? { ...alert, acknowledged: true } : alert
          )
        )
      } else if (path === 'delete') {
        setAlerts((current) => current.filter((alert) => alert.id !== id))
      }
    } catch (error) {
      console.error('Alert action failed', error)
      window.alert('Unable to update the alert. See console for details.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="overflow-auto rounded-2xl border border-[#1E1E2E] bg-[#0B1222] p-1">
      <table className="min-w-full table-auto text-sm">
        <thead>
          <tr className="text-left text-slate-400">
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Level</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Event</th>
            <th className="px-4 py-3">Payload</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {alerts.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-slate-400 text-center">
                No alerts recorded.
              </td>
            </tr>
          ) : (
            alerts.map((alert) => (
              <tr
                key={alert.id}
                className={`border-t border-[#1E1E2E] ${alert.acknowledged ? 'bg-slate-900/60' : ''}`}
              >
                <td className="px-4 py-3 align-top">
                  {new Date(alert.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 align-top font-semibold">{alert.level}</td>
                <td className="px-4 py-3 align-top">{alert.source}</td>
                <td className="px-4 py-3 align-top">{alert.event_type}</td>
                <td className="px-4 py-3 align-top break-words max-w-[28rem] text-slate-300">
                  <pre className="whitespace-pre-wrap break-words">{JSON.stringify(alert.payload)}</pre>
                </td>
                <td className="px-4 py-3 align-top">
                  {alert.acknowledged ? (
                    <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold uppercase text-emerald-300">
                      Acknowledged
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-yellow-500/10 px-2 py-1 text-[11px] font-semibold uppercase text-yellow-300">
                      New
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 align-top space-x-2">
                  <button
                    type="button"
                    disabled={alert.acknowledged || busyId === alert.id}
                    onClick={() => updateAlert(alert.id, 'acknowledge')}
                    className="rounded-lg bg-slate-700 px-3 py-2 text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    disabled={busyId === alert.id}
                    onClick={() => {
                      if (window.confirm('Delete this alert?')) {
                        updateAlert(alert.id, 'delete')
                      }
                    }}
                    className="rounded-lg bg-[#FF6B35] px-3 py-2 text-black transition hover:bg-[#ff8458] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
