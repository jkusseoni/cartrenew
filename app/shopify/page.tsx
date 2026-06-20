export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabase";
import { isValidShopDomain, verifyOAuthHmac } from "@/lib/shopify/config";

type SearchParams = Record<string, string | string[] | undefined>;

function toQueryString(params: SearchParams): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") search.set(key, value);
    else if (Array.isArray(value) && value[0] != null) search.set(key, value[0]);
  }
  return search;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0B0F17] text-white flex flex-col">
      <header className="border-b border-neutral-900 px-6 py-4 flex items-center gap-2">
        <span className="text-lg font-black tracking-tight">
          Cart<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF]">Renew</span>
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

export default async function ShopifyEntryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const shop = typeof params.shop === "string" ? params.shop : undefined;

  if (!isValidShopDomain(shop)) {
    return (
      <Notice
        title="Open from Shopify"
        body="Launch CartRenew from your Shopify Admin (Apps → CartRenew). A valid shop context is required to load your dashboard."
      />
    );
  }

  // Standalone session check: when Shopify opens the app URL it appends an HMAC
  // over the query string. Verify it when present; require it in production.
  const query = toQueryString(params);
  const hasHmac = query.has("hmac");

  if (hasHmac && !verifyOAuthHmac(query)) {
    return (
      <Notice
        title="Verification failed"
        body="The request signature from Shopify could not be verified. Please reopen the app from your Shopify Admin."
      />
    );
  }

  if (!hasHmac && process.env.NODE_ENV === "production") {
    return (
      <Notice
        title="Open from Shopify"
        body="This page must be opened from your Shopify Admin so we can securely verify your store session."
      />
    );
  }

  // Resolve the installed store (created during the HMAC-verified OAuth callback).
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
      />
    );
  }

  // Not installed yet → start the OAuth handshake.
  if (!store) {
    redirect(`/api/auth/shopify?shop=${encodeURIComponent(shop)}`);
  }

  // Load this store's real recovery data.
  const { data: carts } = await supabaseAdmin
    .from("abandoned_carts")
    .select("id, customer_name, customer_phone, cart_value, status, created_at")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = carts ?? [];
  const recovered = rows.filter((c) => c.status === "recovered");
  const pending = rows.filter((c) => c.status === "pending");
  const recoveredRevenue = recovered.reduce((sum, c) => sum + (Number(c.cart_value) || 0), 0);

  return (
    <Shell>
      <div className="border-b border-neutral-900/60 pb-6 mb-8">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Cart Recovery Console</h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
          Connected store: <span className="text-[#00DF89] font-mono">{store.shopify_domain}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-neutral-950/40 border border-neutral-900 p-5 rounded-2xl">
          <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">Tracked Carts</p>
          <p className="text-2xl font-mono font-black text-white mt-2">{rows.length}</p>
        </div>
        <div className="bg-neutral-950/40 border border-neutral-900 p-5 rounded-2xl">
          <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">Recovered</p>
          <p className="text-2xl font-mono font-black text-[#00DF89] mt-2">{recovered.length}</p>
        </div>
        <div className="bg-neutral-950/40 border border-neutral-900 p-5 rounded-2xl">
          <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">Recovered Value</p>
          <p className="text-2xl font-mono font-black text-[#00D1FF] mt-2">
            {recoveredRevenue.toLocaleString()}
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
                        cart.status === "recovered"
                          ? "bg-emerald-950/40 text-[#00DF89] border border-emerald-900/30"
                          : cart.status === "pending"
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
        {pending.length} pending · {recovered.length} recovered · showing latest {rows.length}
      </p>
    </Shell>
  );
}
