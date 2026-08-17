"use client";

import { useEffect, useState, useTransition } from "react";

import ShopifyBillingPlans from "@/components/shopify/ShopifyBillingPlans";
import { authFetch } from "@/lib/shopify/authFetch";
import type {
  ShopifyCartRow,
  ShopifyDashboardMetrics,
  ShopifyStoreRow,
} from "@/lib/shopify/dashboard";

type DashboardResponse = {
  shop: string;
  merchantId?: string;
  store: ShopifyStoreRow | null;
  metrics: ShopifyDashboardMetrics;
  carts: ShopifyCartRow[];
  needsInstall?: boolean;
  error?: string;
};

const EMPTY_METRICS: ShopifyDashboardMetrics = {
  trackedCarts: 0,
  recovered: 0,
  recoveredValue: 0,
};

function normalizeCartStatus(status: string): string {
  return status.trim().toLowerCase();
}

function isRecoveredStatus(status: string): boolean {
  return normalizeCartStatus(status) === "recovered";
}

function isPendingStatus(status: string): boolean {
  return normalizeCartStatus(status) === "pending";
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Top-level reload of the embedded App URL — escapes iframe auth dead-ends without legacy OAuth. */
function reloadEmbeddedApp(shop?: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (shop && !params.get("shop")) params.set("shop", shop);
  const next = `/app?${params.toString()}`;
  const topWindow = window.top ?? window;
  topWindow.location.href = next;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0B0F17] text-white flex flex-col">
      <header className="border-b border-neutral-900 px-6 py-4 flex items-center gap-2">
        <span className="text-lg font-black tracking-tight">
          Cart
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF]">
            Renew
          </span>
        </span>
        <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
          Shopify
        </span>
      </header>
      <div className="flex-1 p-6 lg:p-10 max-w-6xl w-full mx-auto">{children}</div>
    </main>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <div className="max-w-md mx-auto mt-20 rounded-2xl border border-neutral-800 bg-neutral-950/40 p-8 text-center">
        <h1 className="text-xl font-black text-white">{title}</h1>
        <p className="mt-3 text-sm text-neutral-400 leading-relaxed">{body}</p>
      </div>
    </Shell>
  );
}

async function fetchDashboard(url: string): Promise<{
  res: Response;
  json: DashboardResponse;
}> {
  const res = await authFetch(url, { method: "GET" });
  const json = (await res.json()) as DashboardResponse;
  return { res, json };
}

/** Token-exchange then re-fetch dashboard. Retries for slow Supabase commits on fresh installs. */
async function completeInstallAndLoadDashboard(
  dashboardUrl: string
): Promise<DashboardResponse | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const exchangeRes = await authFetch("/api/auth/token-exchange", {
      method: "POST",
    });

    if (!exchangeRes.ok) {
      await sleep(400 * (attempt + 1));
      continue;
    }

    await sleep(200 * (attempt + 1));

    const { res, json } = await fetchDashboard(dashboardUrl);
    if (res.ok && json.store && !json.needsInstall) {
      return {
        ...json,
        carts: json.carts ?? [],
        metrics: json.metrics ?? EMPTY_METRICS,
      };
    }
  }

  return null;
}

export default function EmbeddedAppHomePage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState("Connecting to Shopify…");
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const shopParam = params.get("shop");
        const url = shopParam
          ? `/api/app/dashboard?shop=${encodeURIComponent(shopParam)}`
          : "/api/app/dashboard";

        setStatusMessage("Loading your store…");
        let { res, json } = await fetchDashboard(url);
        if (cancelled) return;

        // Fresh managed install: no store row yet — exchange token then load (incl. zero carts).
        if (res.ok && json.needsInstall && json.shop) {
          setStatusMessage("Finishing install…");
          const installed = await completeInstallAndLoadDashboard(url);
          if (cancelled) return;

          if (installed) {
            startTransition(() => {
              setData(installed);
              setLoading(false);
            });
            return;
          }

          // Last resort: top-level remount of /app (not legacy OAuth — that route was removed).
          setStatusMessage("Almost ready — refreshing…");
          reloadEmbeddedApp(json.shop);
          return;
        }

        // Transient session rejection — retry once, then token-exchange recovery.
        if (res.status === 401) {
          setStatusMessage("Refreshing session…");
          await sleep(500);
          if (cancelled) return;

          ({ res, json } = await fetchDashboard(url));
          if (cancelled) return;

          if (res.ok && json.needsInstall && json.shop) {
            setStatusMessage("Finishing install…");
            const installed = await completeInstallAndLoadDashboard(url);
            if (cancelled) return;
            if (installed) {
              startTransition(() => {
                setData(installed);
                setLoading(false);
              });
              return;
            }
          }

          if (res.ok && json.store) {
            startTransition(() => {
              setData({
                ...json,
                carts: json.carts ?? [],
                metrics: json.metrics ?? EMPTY_METRICS,
              });
              setLoading(false);
            });
            return;
          }

          const shop = json.shop || shopParam;
          if (shop) {
            setStatusMessage("Recovering session…");
            const installed = await completeInstallAndLoadDashboard(url);
            if (cancelled) return;
            if (installed) {
              startTransition(() => {
                setData(installed);
                setLoading(false);
              });
              return;
            }
            reloadEmbeddedApp(shop);
            return;
          }

          // No shop yet — keep a soft loading state (never a "Session required" error page).
          setStatusMessage("Waiting for Shopify Admin session…");
          await sleep(1000);
          if (!cancelled) reloadEmbeddedApp(shopParam);
          return;
        }

        if (!res.ok) {
          const shop = json.shop || shopParam;
          setStatusMessage("Retrying…");
          if (shop) {
            const installed = await completeInstallAndLoadDashboard(url);
            if (cancelled) return;
            if (installed) {
              startTransition(() => {
                setData(installed);
                setLoading(false);
              });
              return;
            }
            reloadEmbeddedApp(shop);
            return;
          }
          setStatusMessage("Waiting for Shopify Admin session…");
          await sleep(1000);
          if (!cancelled) reloadEmbeddedApp(shopParam);
          return;
        }

        // Happy path — including brand-new stores with zero carts / zero metrics.
        startTransition(() => {
          setData({
            ...json,
            carts: json.carts ?? [],
            metrics: json.metrics ?? EMPTY_METRICS,
          });
          setLoading(false);
        });
      } catch {
        if (cancelled) return;
        // Never paint a static error page — recover via top-level /app remount.
        setStatusMessage("Reconnecting…");
        const shop = new URLSearchParams(window.location.search).get("shop");
        await sleep(600);
        if (!cancelled) reloadEmbeddedApp(shop);
      }
    };

    // App Bridge injects window.shopify after the sync CDN script runs.
    let attempts = 0;
    const tryLoad = () => {
      const shopify = (window as Window & { shopify?: { idToken?: () => Promise<string> } })
        .shopify;
      if (shopify?.idToken) {
        void load();
        return;
      }
      attempts += 1;
      if (attempts > 100) {
        // ~5s without App Bridge — remount rather than show an error banner.
        setStatusMessage("Reconnecting to Shopify…");
        reloadEmbeddedApp(new URLSearchParams(window.location.search).get("shop"));
        return;
      }
      window.setTimeout(tryLoad, 50);
    };

    tryLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !data) {
    return (
      <Notice
        title="Setting up CartRenew"
        body={statusMessage}
      />
    );
  }

  const store = data.store ?? {
    id: data.merchantId ?? "pending",
    shopify_domain: data.shop,
  };
  const rows = data.carts ?? [];
  const metrics = data.metrics ?? EMPTY_METRICS;
  const pending = rows.filter((c) => isPendingStatus(c.status));
  const recoveredRows = rows.filter((c) => isRecoveredStatus(c.status));
  const host =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("host") ?? undefined
      : undefined;

  return (
    <Shell>
      <div className="border-b border-neutral-900/60 pb-6 mb-8">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Cart Recovery Console</h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
          Connected store:{" "}
          <span className="text-[#00DF89] font-mono">{store.shopify_domain}</span>
        </p>
      </div>

      <ShopifyBillingPlans
        shop={store.shopify_domain}
        host={host}
        currentPlan={store.billing_plan}
        billingStatus={store.billing_status}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-neutral-950/40 border border-neutral-900 p-5 rounded-2xl">
          <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
            Tracked Carts
          </p>
          <p className="text-2xl font-mono font-black text-white mt-2">{metrics.trackedCarts}</p>
        </div>
        <div className="bg-neutral-950/40 border border-neutral-900 p-5 rounded-2xl">
          <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
            Recovered
          </p>
          <p className="text-2xl font-mono font-black text-[#00DF89] mt-2">{metrics.recovered}</p>
        </div>
        <div className="bg-neutral-950/40 border border-neutral-900 p-5 rounded-2xl">
          <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
            Recovered Value
          </p>
          <p className="text-2xl font-mono font-black text-[#00D1FF] mt-2">
            {metrics.recoveredValue.toLocaleString()}
          </p>
        </div>
      </div>

      <h2 className="text-lg font-bold tracking-tight mb-3">Recent Abandoned Carts</h2>
      <div className="w-full overflow-x-auto rounded-2xl border border-neutral-900 bg-neutral-950/20">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b border-neutral-900 bg-neutral-900/30 text-xs font-black uppercase tracking-wider text-neutral-500">
              <th className="p-4">Customer</th>
              <th className="p-4">Phone</th>
              <th className="p-4">Cart Value</th>
              <th className="p-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900/50 text-xs sm:text-sm text-neutral-300">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-neutral-500">
                  No abandoned carts captured yet. They will appear here as Shopify webhooks fire.
                </td>
              </tr>
            ) : (
              rows.map((cart) => (
                <tr key={cart.id} className="hover:bg-neutral-900/20 transition-colors">
                  <td className="p-4 font-bold text-white">{cart.customer_name || "Guest"}</td>
                  <td className="p-4 font-mono text-neutral-400">
                    {cart.customer_phone || "—"}
                  </td>
                  <td className="p-4 font-mono font-bold text-neutral-200">
                    {(Number(cart.cart_value) || 0).toLocaleString()}
                  </td>
                  <td className="p-4 text-right">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isRecoveredStatus(cart.status)
                          ? "bg-emerald-950/40 text-[#00DF89] border border-emerald-900/30"
                          : isPendingStatus(cart.status)
                            ? "bg-amber-950/40 text-amber-400 border border-amber-900/30"
                            : "bg-neutral-900 text-neutral-500 border border-neutral-800"
                      }`}
                    >
                      {cart.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-[11px] text-neutral-600">
        {pending.length} pending · {recoveredRows.length} recovered · showing latest {rows.length}
      </p>
    </Shell>
  );
}
