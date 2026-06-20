import AnalyticsDailyMatrix from "./AnalyticsDailyMatrix";

export const dynamic = "force-dynamic";

export default function AdminAnalyticsPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Admin</p>
          <h1 className="text-2xl font-semibold text-slate-900">Analytics Matrix</h1>
          <p className="mt-2 text-sm text-slate-500">
            Monitor daily recovery performance and saved revenue signals.
          </p>
        </div>

        <AnalyticsDailyMatrix />
      </div>
    </main>
  );
}
