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

function normalizeCartStatus(status: string): string {
  return status.trim().toLowerCase();
}

function isRecoveredStatus(status: string): boolean {
  return normalizeCartStatus(status) === "recovered";
}

function isPendingStatus(status: string): boolean {
  return normalizeCartStatus(status) === "pending";
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

export default function EmbeddedAppHomePage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
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

        const res = await authFetch(url, { method: "GET" });
        const json = (await res.json()) as DashboardResponse;

        if (cancelled) return;

        if (res.status === 401) {
          setError(json.error || "Session token rejected");
          setLoading(false);
          return;
        }

        if (json.needsInstall && json.shop) {
          window.location.href = `/api/auth/shopify?shop=${encodeURIComponent(json.shop)}`;
          return;
        }

        if (!res.ok) {
          setError(json.error || "Failed to load dashboard");
          setLoading(false);
          return;
        }

        startTransition(() => {
          setData(json);
          setError(null);
          setLoading(false);
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to authenticate with Shopify");
        setLoading(false);
      }
    };

    // App Bridge injects window.shopify after the sync CDN script runs.
    const tryLoad = () => {
      const shopify = (window as Window & { shopify?: { idToken?: () => Promise<string> } })
        .shopify;
      if (shopify?.idToken) {
        void load();
        return;
      }
      window.setTimeout(tryLoad, 50);
    };

    tryLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Notice
        title="Session required"
        body={error}
      />
    );
  }

  if (loading || !data) {
    return (
      <Notice
        title="Connecting to Shopify"
        body="Requesting a session token from App Bridge…"
      />
    );
  }

  const store = data.store ?? {
    id: data.merchantId ?? "pending",
    shopify_domain: data.shop,
  };
  const rows = data.carts;
  const metrics = data.metrics;
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
