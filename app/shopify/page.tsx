export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { AppBridgeHead } from "@/components/shopify/AppBridgeHead";
import { ShopifyEmbedGuard } from "@/components/shopify/ShopifyEmbedGuard";
import { supabaseAdmin } from "@/lib/supabase";
import { getShopifyClientId, isValidShopDomain, verifyOAuthHmac } from "@/lib/shopify/config";

type SearchParams = Record<string, string | string[] | undefined>;

type CartRow = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  cart_value: number;
  status: string;
  created_at: string;
};

type StoreRow = { id: string; shopify_domain: string };

type DashboardMetrics = {
  trackedCarts: number;
  recovered: number;
  recoveredValue: number;
};

type DashboardData = {
  store: StoreRow | null;
  carts: CartRow[];
  metrics: DashboardMetrics;
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

function describeSupabaseError(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const row = error as Record<string, unknown>;
    return [row.message, row.code, row.details, row.hint]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" · ");
  }
  return String(error);
}

async function ensureDevStore(shop: string): Promise<StoreRow | null> {
  const { data, error } = await supabaseAdmin
    .from("stores")
    .upsert(
      {
        shopify_domain: shop,
        shopify_access_token: "dev-offline-token-placeholder",
        clerk_user_id: `sandbox_${shop.replace(/[^a-z0-9]/gi, "_")}`,
      },
      { onConflict: "shopify_domain" }
    )
    .select("id, shopify_domain")
    .maybeSingle();

  if (error) {
    const message = describeSupabaseError(error);
    if (message) {
      console.warn(`[CartRenew] Could not auto-provision store for ${shop}: ${message}`);
    }
    return null;
  }

  return (data as StoreRow | null) ?? null;
}

async function loadStoreDashboard(shop: string, options?: { autoProvision?: boolean }): Promise<DashboardData> {
  const empty: DashboardData = {
    store: null,
    carts: [],
    metrics: { trackedCarts: 0, recovered: 0, recoveredValue: 0 },
  };

  try {
    let { data: store, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("id, shopify_domain")
      .eq("shopify_domain", shop)
      .maybeSingle();

    if (storeError) {
      const message = describeSupabaseError(storeError);
      if (message) {
        console.warn(`[CartRenew] Supabase store lookup failed for ${shop}: ${message}`);
      }
      return empty;
    }

    if (!store && options?.autoProvision) {
      store = await ensureDevStore(shop);
    }

    if (!store) {
      return empty;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const startDateStr = startDate.toISOString().split("T")[0];

    const [cartsRes, analyticsRes] = await Promise.all([
      supabaseAdmin
        .from("abandoned_carts")
        .select("id, customer_name, customer_phone, cart_value, status, created_at")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("analytics_daily")
        .select("carts_created, carts_recovered, revenue_recovered")
        .eq("store_id", store.id)
        .gte("date", startDateStr),
    ]);

    const carts = (cartsRes.data ?? []) as CartRow[];
    const analytics = analyticsRes.data ?? [];

    const metrics = analytics.reduce<DashboardMetrics>(
      (acc, row) => ({
        trackedCarts: acc.trackedCarts + (row.carts_created ?? 0),
        recovered: acc.recovered + (row.carts_recovered ?? 0),
        recoveredValue: acc.recoveredValue + Number(row.revenue_recovered ?? 0),
      }),
      { trackedCarts: 0, recovered: 0, recoveredValue: 0 }
    );

    // Fall back to live cart rows when analytics_daily has not been populated yet.
    if (metrics.trackedCarts === 0 && carts.length > 0) {
      const recoveredCarts = carts.filter((c) => isRecoveredStatus(c.status));
      metrics.trackedCarts = carts.length;
      metrics.recovered = recoveredCarts.length;
      metrics.recoveredValue = recoveredCarts.reduce(
        (sum, c) => sum + (Number(c.cart_value) || 0),
        0
      );
    }

    return { store: store as StoreRow, carts, metrics };
  } catch (err) {
    const message = describeSupabaseError(err);
    if (message) {
      console.warn(`[CartRenew] Dashboard load failed for ${shop}: ${message}`);
    }
    return empty;
  }
}

function toQueryString(params: SearchParams): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") search.set(key, value);
    else if (Array.isArray(value) && value[0] != null) search.set(key, value[0]);
  }
  return search;
}

function Shell({
  children,
  host,
  embedded,
}: {
  children: React.ReactNode;
  host?: string;
  embedded: boolean;
}) {
  const apiKey = getShopifyClientId();
  return (
    <main className="min-h-screen bg-[#0B0F17] text-white flex flex-col">
      <ShopifyEmbedGuard embedded={embedded} />
      <AppBridgeHead apiKey={apiKey} host={host} embedded={embedded} />
      <header className="border-b border-neutral-900 px-6 py-4 flex items-center gap-2">
        <span className="text-lg font-black tracking-tight">
          Cart<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF]">Renew</span>
        </span>
        <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
          Shopify
        </span>
        {!embedded && (
          <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-900/30 text-amber-400">
            Standalone
          </span>
        )}
      </header>
      <div className="flex-1 p-6 lg:p-10 max-w-6xl w-full mx-auto">{children}</div>
    </main>
  );
}

function Notice({
  title,
  body,
  host,
  embedded,
}: {
  title: string;
  body: string;
  host?: string;
  embedded: boolean;
}) {
  return (
    <Shell host={host} embedded={embedded}>
      <div className="max-w-md mx-auto mt-20 rounded-2xl border border-neutral-800 bg-neutral-950/40 p-8 text-center">
        <h1 className="text-xl font-black text-white">{title}</h1>
        <p className="mt-3 text-sm text-neutral-400 leading-relaxed">{body}</p>
      </div>
    </Shell>
  );
}

function Console({
  store,
  rows,
  metrics,
  host,
  embedded,
}: {
  store: StoreRow;
  rows: CartRow[];
  metrics: DashboardMetrics;
  host?: string;
  embedded: boolean;
}) {
  const pending = rows.filter((c) => isPendingStatus(c.status));
  const recoveredRows = rows.filter((c) => isRecoveredStatus(c.status));

  return (
    <Shell host={host} embedded={embedded}>
      <div className="border-b border-neutral-900/60 pb-6 mb-8">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Cart Recovery Console</h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
          Connected store: <span className="text-[#00DF89] font-mono">{store.shopify_domain}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-neutral-950/40 border border-neutral-900 p-5 rounded-2xl">
          <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">Tracked Carts</p>
          <p className="text-2xl font-mono font-black text-white mt-2">{metrics.trackedCarts}</p>
        </div>
        <div className="bg-neutral-950/40 border border-neutral-900 p-5 rounded-2xl">
          <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">Recovered</p>
          <p className="text-2xl font-mono font-black text-[#00DF89] mt-2">{metrics.recovered}</p>
        </div>
        <div className="bg-neutral-950/40 border border-neutral-900 p-5 rounded-2xl">
          <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">Recovered Value</p>
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
                  <td className="p-4 font-mono text-neutral-400">{cart.customer_phone || "—"}</td>
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

export default async function ShopifyEntryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const shop = typeof params.shop === "string" ? params.shop : undefined;
  const host = typeof params.host === "string" ? params.host : undefined;
  const embedded = Boolean(host && host.length > 0);
  const isDev = process.env.NODE_ENV !== "production";

  if (!isValidShopDomain(shop)) {
    return (
      <Notice
        title="Open from Shopify"
        body="Launch CartRenew from your Shopify Admin (Apps → CartRenew), or append ?shop=your-store.myshopify.com for local dev."
        host={host}
        embedded={embedded}
      />
    );
  }

  // Local dev: bypass HMAC, host, OAuth, and iframe gates — load live Supabase data.
  if (isDev) {
    const dashboard = await loadStoreDashboard(shop, { autoProvision: true });

    return (
      <Console
        store={dashboard.store ?? { id: "pending", shopify_domain: shop }}
        rows={dashboard.carts}
        metrics={dashboard.metrics}
        host={host}
        embedded={embedded}
      />
    );
  }

  // Production: enforce embedded + HMAC verification.
  const query = toQueryString(params);
  const hasHmac = query.has("hmac");

  if (!embedded) {
    return (
      <Notice
        title="Open from Shopify Admin"
        body="This app must be opened from your Shopify Admin panel so App Bridge can establish a secure session."
        host={host}
        embedded={embedded}
      />
    );
  }

  if (hasHmac && !verifyOAuthHmac(query)) {
    return (
      <Notice
        title="Verification failed"
        body="The request signature from Shopify could not be verified. Please reopen the app from your Shopify Admin."
        host={host}
        embedded={embedded}
      />
    );
  }

  if (!hasHmac) {
    return (
      <Notice
        title="Open from Shopify"
        body="This page must be opened from your Shopify Admin so we can securely verify your store session."
        host={host}
        embedded={embedded}
      />
    );
  }

  const { data: store, error } = await supabaseAdmin
    .from("stores")
    .select("id, shopify_domain, created_at")
    .eq("shopify_domain", shop)
    .maybeSingle();

  if (error) {
    console.error("Shopify entry: store lookup failed", error);
    return (
      <Notice
        title="Something went wrong"
        body="We couldn't load your store right now. Please try again in a moment."
        host={host}
        embedded={embedded}
      />
    );
  }

  if (!store) {
    redirect(`/api/auth/shopify?shop=${encodeURIComponent(shop)}`);
  }

  const dashboard = await loadStoreDashboard(shop);

  return (
    <Console
      store={dashboard.store ?? (store as StoreRow)}
      rows={dashboard.carts}
      metrics={dashboard.metrics}
      host={host}
      embedded={embedded}
    />
  );
}
