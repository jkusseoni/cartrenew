import PricingTable from '@/components/PricingTable'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-[#0A0A0F] text-slate-100">
      <main className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex rounded-full bg-white/5 px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-slate-300 ring-1 ring-white/10">
              WhatsApp Cart Recovery for modern D2C brands
            </div>
            <div className="space-y-6">
              <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Recover abandoned carts with WhatsApp automation built for Shopify stores.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                CartRenew helps you recover revenue with intelligent WhatsApp follow-ups, AI personalized messages, and a dashboard built for growth.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-8 py-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Start Your Free Trial
              </Link>
              <Link
                href="/settings"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-white/5 px-8 py-4 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-white/10"
              >
                View Integrations
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
                <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Recovery rate</p>
                <p className="mt-3 text-3xl font-semibold text-white">68%</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
                <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Channels</p>
                <p className="mt-3 text-3xl font-semibold text-white">WhatsApp, Email, SMS</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
                <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Launch</p>
                <p className="mt-3 text-3xl font-semibold text-white">Built for Shopify</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-white/5 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.45)] backdrop-blur-xl">
            <div className="rounded-3xl border border-[#1E1E2E] bg-[#13131A] p-6">
              <p className="text-sm uppercase tracking-[0.18em] text-emerald-300">CartRenew</p>
              <h2 className="mt-4 text-2xl font-semibold text-white">WhatsApp cart recovery without hidden fees.</h2>
              <p className="mt-4 text-slate-400">
                Recover more revenue with automated reminders, ROI-first analytics, and flexible pricing for every stage.
              </p>
              <div className="mt-6 grid gap-3 text-sm text-slate-300">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#00C896]/20 text-emerald-300">✓</span>
                  <span>Fast setup for Shopify and WhatsApp Business API</span>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#FF6B35]/20 text-orange-300">✓</span>
                  <span>Ready-to-use templates with AI personalization</span>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#7C3AED]/20 text-violet-300">✓</span>
                  <span>Optimize recovery flows with real-time analytics</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <section className="border-t border-slate-800/80 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 rounded-3xl border border-slate-800 bg-white/5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Trusted by 100+ Shopify Brands</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-[#13131A]/90 px-4 py-3 text-sm text-slate-200">
              <p className="font-semibold text-white">0% Markup Guaranteed</p>
              <p className="mt-1 text-slate-400">Transparent recovery pricing</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-[#13131A]/90 px-4 py-3 text-sm text-slate-200">
              <p className="font-semibold text-white">Secure Setup</p>
              <p className="mt-1 text-slate-400">Shopify + WhatsApp-safe onboarding</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-[#13131A]/90 px-4 py-3 text-sm text-slate-200">
              <p className="font-semibold text-white">14-day Free Trial</p>
              <p className="mt-1 text-slate-400">No commitment, instant activation</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800/80 pt-12">
        <PricingTable />
      </section>
    </div>
  )
}
