import React from 'react'
import AlertsTableClient from './AlertsTableClient'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function Page() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in')
  }

  const { data: alertsData } = await supabaseAdmin
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const alerts = Array.isArray(alertsData) ? alertsData : []

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold">System Alerts</h1>
          <p className="text-sm text-slate-500 mt-2">Monitor automated cart failures and manage alert state directly from the dashboard.</p>
        </div>
      </div>

      <AlertsTableClient initialAlerts={alerts} />
    </div>
  )
}
