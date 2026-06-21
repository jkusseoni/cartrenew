'use client'

import { useCallback, useEffect, useState } from 'react'

type ServiceStatus = {
  ok: boolean
  label: string
  bypass?: boolean
}

type SystemStatusPayload = {
  supabase: ServiceStatus
  shopifyWebhooks: ServiceStatus
  whatsApp: ServiceStatus
  checkedAt?: string
}

const POLL_MS = 30_000

function StatusItem({
  name,
  status,
}: {
  name: string
  status: ServiceStatus | null
}) {
  const active = status?.ok ?? false
  const label = status?.label ?? 'Checking…'

  return (
    <div className="flex items-center gap-2 text-xs text-neutral-300">
      <span
        className={`relative inline-flex h-2 w-2 shrink-0 rounded-full ${
          active ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'
        }`}
        aria-hidden
      >
        {active ? (
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/40 animate-ping" />
        ) : null}
      </span>
      <span className="font-medium text-neutral-400">{name}</span>
      <span className="text-neutral-200">{label}</span>
    </div>
  )
}

export default function GlobalApiStatusBar() {
  const [status, setStatus] = useState<SystemStatusPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/system/status', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Status check failed (${response.status})`)
      }
      const payload = (await response.json()) as SystemStatusPayload
      setStatus(payload)
    } catch {
      setStatus({
        supabase: { ok: false, label: 'Unreachable' },
        shopifyWebhooks: { ok: false, label: 'Unreachable' },
        whatsApp: { ok: false, label: 'Unreachable' },
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => {
      void refresh()
    }, POLL_MS)
    return () => window.clearInterval(interval)
  }, [refresh])

  return (
    <div
      className="sticky top-0 z-[100] w-full border-b border-white/[0.08] bg-[#0B0F17]/55 backdrop-blur-xl backdrop-saturate-150"
      role="status"
      aria-live="polite"
      aria-busy={loading}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-2 sm:justify-between sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
          System Status
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-end">
          <StatusItem name="Supabase Database" status={status?.supabase ?? null} />
          <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden />
          <StatusItem name="Shopify Webhooks" status={status?.shopifyWebhooks ?? null} />
          <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden />
          <StatusItem name="WhatsApp Engine" status={status?.whatsApp ?? null} />
        </div>
      </div>
    </div>
  )
}
