"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import { Link } from "@/i18n/routing";
import { useSafeUser } from "@/lib/clerk";

interface DailyAnalytics {
  date: string;
  carts_created: number;
  messages_sent: number;
  messages_delivered: number;
  messages_read: number;
  carts_recovered: number;
  revenue_recovered: number;
}

type AnalyticsTotals = {
  cartsCreated: number;
  messagesSent: number;
  deliveredRate: number;
  readRate: number;
  recoveredRate: number;
  revenue: number;
};

type AnalyticsFetchResult = {
  daily: DailyAnalytics[];
  totals: AnalyticsTotals;
  storeConnected?: boolean;
  error?: string;
};

const EMPTY_ANALYTICS_TOTALS: AnalyticsTotals = {
  cartsCreated: 0,
  messagesSent: 0,
  deliveredRate: 0,
  readRate: 0,
  recoveredRate: 0,
  revenue: 0,
};

function getAnalyticsApiUrl(days: number): string {
  return `/api/analytics?days=${days}`;
}

async function fetchAnalyticsData(days: number): Promise<AnalyticsFetchResult> {
  const requestUrl = getAnalyticsApiUrl(days);

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP Error Status: ${response.status}`);
    }

    const data = (await response.json()) as {
      daily?: DailyAnalytics[];
      totals?: {
        totalAbandoned?: number;
        cartsCreated?: number;
        messagesSent?: number;
        recoveredRevenue?: number;
        revenue?: number;
        recoveredRate?: number;
        deliveredRate?: number;
        readRate?: number;
      };
      storeConnected?: boolean;
      error?: string;
    };

    const totals = data.totals ?? {};

    return {
      daily: data.daily ?? [],
      totals: {
        cartsCreated: totals.totalAbandoned ?? totals.cartsCreated ?? 0,
        messagesSent: totals.messagesSent ?? 0,
        deliveredRate: totals.deliveredRate ?? 0,
        readRate: totals.readRate ?? 0,
        recoveredRate: totals.recoveredRate ?? 0,
        revenue: totals.recoveredRevenue ?? totals.revenue ?? 0,
      },
      storeConnected: data.storeConnected,
      error: data.error,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Analytics fetch failed for URL:", requestUrl, error);

    return {
      daily: [],
      totals: EMPTY_ANALYTICS_TOTALS,
      storeConnected: false,
      error: message,
    };
  }
}

export default function AnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  use(params);
  const { user, isLoaded } = useSafeUser();
  const [analytics, setAnalytics] = useState<DailyAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [storeConnected, setStoreConnected] = useState<boolean | null>(null);
  const [dateRange, setDateRange] = useState(30);
  const requestIdRef = useRef(0);

  const fetchAnalytics = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const isCurrent = () => requestId === requestIdRef.current;

    try {
      setLoading(true);
      setFetchError(null);
      const result = await fetchAnalyticsData(dateRange);
      if (!isCurrent()) return;

      setAnalytics(result.daily);
      setStoreConnected(result.storeConnected ?? null);
      setFetchError(result.error ?? null);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    if (!isLoaded) return;
    // Fetch even without a Clerk session in local/dev (useSafeUser provides a fake user).
    void fetchAnalytics();
  }, [fetchAnalytics, isLoaded, user]);

  const totals = analytics.reduce(
    (acc, day) => ({
      cartsCreated: acc.cartsCreated + (day.carts_created || 0),
      messagesSent: acc.messagesSent + (day.messages_sent || 0),
      messagesDelivered: acc.messagesDelivered + (day.messages_delivered || 0),
      messagesRead: acc.messagesRead + (day.messages_read || 0),
      cartsRecovered: acc.cartsRecovered + (day.carts_recovered || 0),
      revenueRecovered: acc.revenueRecovered + (day.revenue_recovered || 0),
    }),
    {
      cartsCreated: 0,
      messagesSent: 0,
      messagesDelivered: 0,
      messagesRead: 0,
      cartsRecovered: 0,
      revenueRecovered: 0,
    }
  );

  const deliveryRate =
    totals.messagesSent > 0
      ? Math.round((totals.messagesDelivered / totals.messagesSent) * 100)
      : 0;

  const readRate =
    totals.messagesSent > 0
      ? Math.round((totals.messagesRead / totals.messagesSent) * 100)
      : 0;

  const recoveryRate =
    totals.cartsCreated > 0
      ? Math.round((totals.cartsRecovered / totals.cartsCreated) * 100)
      : 0;

  const BarChart = ({ data, color }: { data: DailyAnalytics[]; color: string }) => {
    const max = Math.max(...data.map((d) => d.carts_created || 0), 1);
    return (
      <div className="mt-4 flex h-40 items-end gap-1">
        {data.map((day) => (
          <div key={day.date} className="group relative flex flex-1 flex-col items-center gap-1">
            <div
              className={`w-full rounded-t ${color} transition-all hover:opacity-80`}
              style={{ height: `${((day.carts_created || 0) / max) * 100}%` }}
            />
            <span className="text-[10px] text-gray-400">{new Date(day.date).getDate()}</span>
            <div className="absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
              {day.date}: {day.carts_created} carts
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void fetchAnalytics()}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Refresh
              </button>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {fetchError && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Could not load live analytics ({fetchError}). Showing available data.
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-2">
          {[7, 14, 30, 90].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setDateRange(days)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                dateRange === days
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryCard label="Carts Created" value={totals.cartsCreated} color="text-blue-600" bg="bg-blue-50" />
          <SummaryCard label="Messages Sent" value={totals.messagesSent} color="text-indigo-600" bg="bg-indigo-50" />
          <SummaryCard label="Delivered" value={`${deliveryRate}%`} color="text-cyan-600" bg="bg-cyan-50" />
          <SummaryCard label="Read Rate" value={`${readRate}%`} color="text-teal-600" bg="bg-teal-50" />
          <SummaryCard label="Recovered" value={`${recoveryRate}%`} color="text-green-600" bg="bg-green-50" />
          <SummaryCard
            label="Revenue"
            value={`₹${totals.revenueRecovered.toLocaleString("en-IN")}`}
            color="text-purple-600"
            bg="bg-purple-50"
          />
        </div>

        {analytics.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Abandoned Carts</h3>
              <BarChart data={analytics} color="bg-blue-500" />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Messages Sent</h3>
              <BarChart
                data={analytics.map((d) => ({ ...d, carts_created: d.messages_sent }))}
                color="bg-indigo-500"
              />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Carts Recovered</h3>
              <BarChart
                data={analytics.map((d) => ({ ...d, carts_created: d.carts_recovered }))}
                color="bg-green-500"
              />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Revenue Recovered</h3>
              <BarChart
                data={analytics.map((d) => ({ ...d, carts_created: d.revenue_recovered }))}
                color="bg-purple-500"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-500">No data yet</p>
            <p className="mt-1 text-sm text-gray-400">
              {storeConnected
                ? "Your Shopify store is connected, but no analytics rows exist yet. Abandoned carts will appear after webhooks run."
                : "Connect your Shopify store to start tracking abandoned carts and recovery revenue."}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/settings"
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Open Integration Settings
              </Link>
              <button
                type="button"
                onClick={() => void fetchAnalytics()}
                className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Retry Fetch
              </button>
            </div>
          </div>
        )}

        {analytics.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Daily Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 font-medium text-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left">Date</th>
                    <th className="px-6 py-3 text-center">Carts</th>
                    <th className="px-6 py-3 text-center">Messages</th>
                    <th className="px-6 py-3 text-center">Delivered</th>
                    <th className="px-6 py-3 text-center">Read</th>
                    <th className="px-6 py-3 text-center">Recovered</th>
                    <th className="px-6 py-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...analytics].reverse().map((day) => (
                    <tr key={day.date} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-900">
                        {new Date(day.date).toLocaleDateString("en-IN", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-3 text-center">{day.carts_created || 0}</td>
                      <td className="px-6 py-3 text-center">{day.messages_sent || 0}</td>
                      <td className="px-6 py-3 text-center">{day.messages_delivered || 0}</td>
                      <td className="px-6 py-3 text-center">{day.messages_read || 0}</td>
                      <td className="px-6 py-3 text-center font-medium text-green-600">
                        {day.carts_recovered || 0}
                      </td>
                      <td className="px-6 py-3 text-right font-medium">
                        ₹{(day.revenue_recovered || 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: string | number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-5`}>
      <p className="mb-1 text-sm text-gray-600">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
