"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useClerk } from '@clerk/nextjs';
import { useParams } from 'next/navigation';

import TrialBanner from '@/components/dashboard/TrialBanner';
import TrialExpiredModal from '@/components/dashboard/TrialExpiredModal';
import DashboardAnalytics from '@/components/dashboard-analytics';
import { useTrialBilling } from '@/hooks/useTrialBilling';
import {
  EMPTY_DASHBOARD_ANALYTICS,
  fetchDashboardAnalytics,
  formatCartChannel,
  formatCartStatus,
  formatInr,
  formatRelativeTime,
  getStatusBadgeClass,
  type DashboardAnalyticsPayload,
} from '@/lib/fetch-dashboard-analytics';

export default function Dashboard() {
  const [activeStore] = useState("My Shopify Store");
  const [analytics, setAnalytics] = useState<DashboardAnalyticsPayload>(EMPTY_DASHBOARD_ANALYTICS);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const { signOut } = useClerk();
  const params = useParams();
  const locale = typeof params.locale === "string" ? params.locale : "en";
  const { ready, access, gateBlocked, gateReason } = useTrialBilling();

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      setAnalyticsLoading(true);
      const data = await fetchDashboardAnalytics(30);
      if (!cancelled) {
        setAnalytics(data);
        setAnalyticsLoading(false);
      }
    }

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.warn("Clerk signOut failed:", error);
    } finally {
      window.location.href = "/en";
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col">
      {ready && access && (
        <TrialBanner
          planType={access.planType}
          planLabel={access.planLabel}
          daysRemaining={access.daysRemaining}
          locale={locale}
        />
      )}

      <div className="flex flex-1 flex-col lg:flex-row min-h-0">
      
      <aside className="w-full lg:w-64 bg-neutral-950 border-b lg:border-b-0 lg:border-r border-neutral-900 p-5 flex flex-col justify-between shrink-0">
        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight">
              Cart<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF]">Renew</span>
            </span>
            <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">v0.1</span>
          </div>

          <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-neutral-900 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded bg-emerald-500/10 flex items-center justify-center text-xs text-[#00DF89]">🛍️</div>
              <span className="text-xs font-bold text-neutral-200 truncate max-w-[120px]">{activeStore}</span>
            </div>
            <span className="text-[10px] text-neutral-500">▼</span>
          </div>

          <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 text-xs font-bold text-neutral-400">
            <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-900 text-[#00DF89] border border-neutral-800/40 shrink-0 lg:w-full">
              <span>🏠</span> Dashboard Summary
            </Link>
            <Link href="/marketing-hub" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-900/40 hover:text-white transition-colors shrink-0 lg:w-full">
              <span>💬</span> Automation Workflows
            </Link>
            <Link href="/analytics" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-900/40 hover:text-white transition-colors shrink-0 lg:w-full">
              <span>📈</span> ROI Analytics
            </Link>
            <Link href="/settings" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-900/40 hover:text-white transition-colors shrink-0 lg:w-full">
              <span>⚙️</span> Core Integration Settings
            </Link>
          </nav>
        </div>

        <div className="pt-4 border-t border-neutral-900 hidden lg:flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-sm">👤</div>
            <div>
              <p className="text-xs font-black text-neutral-200 leading-none">Merchant Account</p>
              <p className="text-[9px] text-neutral-500 font-mono mt-1">ID: Pro-Active</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-bold text-neutral-500 hover:text-rose-400 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="relative flex-1 p-4 sm:p-6 lg:p-8 space-y-8 overflow-y-auto max-w-7xl">
        <div
          className={`space-y-8 transition-all duration-300 ${
            gateBlocked ? "pointer-events-none select-none blur-md opacity-60" : ""
          }`}
        >
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900/60 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Console Workspace</h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">Real-time status monitoring of Shopify client abandonment triggers.</p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-xs font-bold text-[#00DF89]">
            <span className="w-2 h-2 rounded-full bg-[#00DF89] animate-pulse" />
            Live Webhook Streams Syncing
          </div>
        </div>

        <DashboardAnalytics
          totalAbandoned={analytics.totalAbandoned}
          messagesSent={analytics.messagesSent}
          recoveredRevenue={analytics.recoveredRevenue}
          recoveredRate={analytics.recoveredRate}
          languageData={analytics.languageData}
          loading={analyticsLoading}
        />

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Continuous Recovery Stream</h3>
            <p className="text-xs text-neutral-400">Live feed mapping incoming Shopify webhooks directly to communication nodes.</p>
          </div>

          <div className="w-full overflow-x-auto rounded-2xl border border-neutral-900 bg-neutral-950/20 backdrop-blur-md">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-neutral-900 bg-neutral-900/30 text-xs font-black uppercase tracking-wider text-neutral-500">
                  <th className="p-4">Session ID</th>
                  <th className="p-4">Customer profile</th>
                  <th className="p-4">Cart Value</th>
                  <th className="p-4">Time Elapsed</th>
                  <th className="p-4">Active Channel</th>
                  <th className="p-4 text-right">Execution Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900/50 font-medium text-xs sm:text-sm text-neutral-300">
                {analyticsLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-neutral-500">
                      Loading recovery stream…
                    </td>
                  </tr>
                ) : analytics.liveFeed.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-neutral-500">
                      No abandoned carts yet. They will appear here as Shopify webhooks and recovery jobs run.
                    </td>
                  </tr>
                ) : (
                  analytics.liveFeed.map((cart) => (
                    <tr key={cart.id} className="hover:bg-neutral-900/20 transition-colors">
                      <td className="p-4 font-mono font-bold text-neutral-400">{cart.id.slice(0, 8).toUpperCase()}</td>
                      <td className="p-4">
                        <div>
                          <p className="font-bold text-white leading-tight">{cart.customerName}</p>
                          {cart.itemsSummary ? (
                            <p className="text-[10px] text-neutral-500 mt-0.5 max-w-[200px] truncate">{cart.itemsSummary}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-4 font-mono font-bold text-neutral-200">{formatInr(cart.cartValue)}</td>
                      <td className="p-4 text-neutral-400">{formatRelativeTime(cart.createdAt)}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-400">
                          {formatCartChannel(cart.channel)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusBadgeClass(cart.status)}`}>
                          {formatCartStatus(cart.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>

      </main>
      </div>

      {gateBlocked && (
        <TrialExpiredModal locale={locale} reason={gateReason} />
      )}
    </div>
  );
}
