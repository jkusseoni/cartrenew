import { supabaseAdmin } from '@/lib/supabase'
import PendingMessagesClient from '@/app/[locale]/dashboard/admin/messages/PendingMessagesClient'
import StoresTableClient from '@/app/[locale]/dashboard/admin/stores/StoresTableClient'
import AnalyticsDailyMatrix from '@/app/[locale]/dashboard/admin/analytics/AnalyticsDailyMatrix'

export const revalidate = 0

export default async function AdminPage() {
  const { data } = await supabaseAdmin
    .from('stores')
    .select('id, shopify_domain, webhook_ids, clerk_user_id, whatsapp_phone_id, updated_at')
    .order('updated_at', { ascending: false })

  const stores = data || []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Local Admin</p>
              <h1 className="text-2xl font-semibold text-slate-900">CartRenew Admin Console</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <StoresTableClient initialStores={stores} />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Daily Analytics</h2>
          <AnalyticsDailyMatrix />
        </div>

        <PendingMessagesClient />
      </main>
    </div>
  )
}
