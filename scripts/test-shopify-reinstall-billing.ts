/**
 * Regression: install → uninstall (token cleared) → reinstall → plan selection
 * must never fail with "Store is not connected", and expiring offline tokens
 * must be stored, refreshed (with rotation) and recovered when refresh fails.
 * Also checks that every Shopify secret use resolves the same client secret.
 *
 * Runs the real route handlers in-process. Global fetch is stubbed with an
 * in-memory Supabase `stores` table and a fake Shopify Admin API, so nothing
 * touches the network or a real database.
 *
 *   npm run test:shopify-reinstall
 */

import { spawnSync } from "child_process";
import { createHmac, randomUUID } from "crypto";
import { existsSync } from "fs";
import path from "path";
import { SignJWT } from "jose";

const SHOP = "reinstall-review-store.myshopify.com";
const CLIENT_ID = "test-client-id";
const CLIENT_SECRET = "shpss_test_secret";
const STALE_SECRET = "shpss_stale_client_secret";

Object.assign(process.env, {
  NODE_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  NEXT_PUBLIC_SHOPIFY_API_KEY: CLIENT_ID,
  SHOPIFY_API_SECRET: CLIENT_SECRET,
  SHOPIFY_CLIENT_SECRET: CLIENT_SECRET,
  SHOPIFY_APP_URL: "https://app.test",
  // Unreachable on purpose: Prisma merchant upserts fail fast and are optional.
  DATABASE_URL: "postgresql://test:test@127.0.0.1:1/none",
});
delete process.env.SHOPIFY_BILLING_TEST;
const BRAND_ENV_KEYS = [
  "NEXT_PUBLIC_APP_NAME",
  "NEXT_PUBLIC_APP_TAGLINE",
  "NEXT_PUBLIC_SUPPORT_EMAIL",
  "NEXT_PUBLIC_APP_URL",
] as const;
for (const key of BRAND_ENV_KEYS) delete process.env[key];

// ─── Fake infrastructure ────────────────────────────────────────────────────

type Row = Record<string, unknown>;

const stores: Row[] = [];

const shopify = {
  partnerDevelopment: true,
  planLookupFails: false,
  /** Simulate a misconfigured client secret on the refresh endpoint. */
  refreshRejectsClient: false,
  currentAccess: null as string | null,
  currentRefresh: null as string | null,
  expiredAccess: new Set<string>(),
  issued: 0,
  exchanges: [] as Array<{ expiring: string | null }>,
  refreshCalls: 0,
  legacyTokenAdminCalls: 0,
  subscriptions: [] as Array<{ id: string; name: unknown; test: unknown; accessToken: string | null; status: string }>,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function project(row: Row, select: string | null): Row {
  if (!select || select === "*") return { ...row };
  return Object.fromEntries(
    select.split(",").map((col) => {
      const key = col.trim();
      return [key, row[key] ?? null];
    })
  );
}

function matchesCondition(row: Row, key: string, expr: string): boolean {
  const dot = expr.indexOf(".");
  const op = expr.slice(0, dot);
  const value = expr.slice(dot + 1);
  const current = row[key];
  if (op === "eq") return String(current ?? "") === value;
  if (op === "is") return value === "null" ? current == null : String(current) === value;
  if (op === "lt") return current != null && Date.parse(String(current)) < Date.parse(value);
  throw new Error(`fake supabase: unsupported filter ${key}=${expr}`);
}

function matchesFilters(row: Row, params: URLSearchParams): boolean {
  for (const [key, value] of params) {
    if (["select", "on_conflict", "limit", "order"].includes(key)) continue;
    if (key === "or") {
      const conditions = value.replace(/^\(|\)$/g, "").split(",");
      const anyMatch = conditions.some((condition) => {
        const dot = condition.indexOf(".");
        return matchesCondition(row, condition.slice(0, dot), condition.slice(dot + 1));
      });
      if (!anyMatch) return false;
      continue;
    }
    if (!matchesCondition(row, key, value)) return false;
  }
  return true;
}

function fakeSupabase(url: URL, method: string, headers: Headers, body: string | null): Response {
  if (url.pathname !== "/rest/v1/stores") return json([]);

  const select = url.searchParams.get("select");
  const wantsObject = (headers.get("accept") ?? "").includes("vnd.pgrst.object");
  const respond = (rows: Row[]) => {
    const projected = rows.map((row) => project(row, select));
    if (!wantsObject) return json(projected);
    if (projected.length === 1) return json(projected[0]);
    return json(
      { code: "PGRST116", message: "JSON object requested", details: `Results contain ${projected.length} rows` },
      406
    );
  };

  if (method === "GET") {
    return respond(stores.filter((row) => matchesFilters(row, url.searchParams)));
  }

  if (method === "PATCH") {
    const patch = JSON.parse(body ?? "{}") as Row;
    const hits = stores.filter((row) => matchesFilters(row, url.searchParams));
    hits.forEach((row) => Object.assign(row, patch));
    return respond(hits);
  }

  if (method === "POST") {
    const input = JSON.parse(body ?? "{}") as Row | Row[];
    const inserted: Row[] = [];
    for (const item of Array.isArray(input) ? input : [input]) {
      if (stores.some((row) => row.shopify_domain === item.shopify_domain)) {
        return json({ code: "23505", message: "duplicate key value" }, 409);
      }
      const row = { id: randomUUID(), billing_plan: null, shopify_subscription_id: null, ...item };
      stores.push(row);
      inserted.push(row);
    }
    return respond(inserted);
  }

  return json({ message: `unsupported ${method}` }, 405);
}

function issueTokens(expiring: boolean) {
  shopify.issued += 1;
  shopify.currentAccess = expiring ? `shpat_test_${shopify.issued}` : `shpat_legacy_${shopify.issued}`;
  shopify.currentRefresh = expiring ? `shprt_test_${shopify.issued}` : null;
  return expiring
    ? {
        access_token: shopify.currentAccess,
        expires_in: 3600,
        refresh_token: shopify.currentRefresh,
        refresh_token_expires_in: 7776000,
        scope: "read_orders",
      }
    : { access_token: shopify.currentAccess, scope: "read_orders" };
}

async function fakeShopify(url: URL, method: string, headers: Headers, body: string | null): Promise<Response> {
  if (url.pathname === "/admin/oauth/access_token" && method === "POST") {
    const form = new URLSearchParams(body ?? "");
    if (form.get("client_id") !== CLIENT_ID || form.get("client_secret") !== CLIENT_SECRET) {
      return json({ error: "invalid_request", error_description: "Missing or invalid client secret" }, 400);
    }

    if (form.get("grant_type") === "refresh_token") {
      shopify.refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (shopify.refreshRejectsClient) {
        return json({ error: "invalid_request", error_description: "Missing or invalid client secret" }, 400);
      }
      if (!form.get("refresh_token") || form.get("refresh_token") !== shopify.currentRefresh) {
        return json(
          { error: "invalid_request", error_description: "This request requires an active refresh_token" },
          401
        );
      }
      return json(issueTokens(true));
    }

    if (
      form.get("grant_type") !== "urn:ietf:params:oauth:grant-type:token-exchange" ||
      !form.get("subject_token")
    ) {
      return json({ error: "invalid_request" }, 400);
    }
    shopify.exchanges.push({ expiring: form.get("expiring") });
    return json(issueTokens(form.get("expiring") === "1"));
  }

  const presented = headers.get("x-shopify-access-token");
  if (presented?.startsWith("shpat_legacy_")) {
    shopify.legacyTokenAdminCalls += 1;
    return json(
      {
        errors:
          "Non-expiring access tokens are no longer accepted for the Admin API. Start using expiring offline tokens",
      },
      403
    );
  }
  if (!presented || presented !== shopify.currentAccess || shopify.expiredAccess.has(presented)) {
    return json({ errors: "[API] Invalid API key or access token" }, 401);
  }

  if (url.pathname.endsWith("/webhooks.json")) {
    if (method === "GET") return json({ webhooks: [] });
    const { webhook } = JSON.parse(body ?? "{}") as { webhook: Row };
    return json({ webhook: { id: randomUUID(), ...webhook } });
  }

  if (url.pathname.endsWith("/graphql.json")) {
    const { query, variables } = JSON.parse(body ?? "{}") as {
      query: string;
      variables?: Row;
    };
    if (query.includes("partnerDevelopment")) {
      if (shopify.planLookupFails) return json({ errors: "Internal error" }, 500);
      return json({ data: { shop: { plan: { partnerDevelopment: shopify.partnerDevelopment } } } });
    }
    if (query.includes("appSubscriptionCreate")) {
      const id = `gid://shopify/AppSubscription/${shopify.subscriptions.length + 1}`;
      shopify.subscriptions.push({
        id,
        name: variables?.name,
        test: variables?.test,
        accessToken: presented,
        status: "PENDING",
      });
      return json({
        data: {
          appSubscriptionCreate: {
            appSubscription: { id, status: "PENDING" },
            confirmationUrl: `https://${SHOP}/admin/charges/${shopify.subscriptions.length}/confirm`,
            userErrors: [],
          },
        },
      });
    }
    if (query.includes("activeSubscriptions")) {
      const latest = shopify.subscriptions.at(-1);
      return json({
        data: {
          currentAppInstallation: {
            activeSubscriptions: latest
              ? [{ id: latest.id, name: "CartRenew Growth", status: "ACTIVE", currentPeriodEnd: null, trialDays: 14 }]
              : [],
          },
        },
      });
    }
  }

  return json({ errors: `unhandled ${method} ${url.pathname}` }, 404);
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = input instanceof Request ? input : null;
  const url = new URL(request ? request.url : String(input));
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers ?? request?.headers);
  const body =
    typeof init?.body === "string"
      ? init.body
      : init?.body instanceof URLSearchParams
        ? init.body.toString()
        : request
          ? await request.text()
          : null;

  if (url.hostname === "supabase.test") return fakeSupabase(url, method, headers, body);
  if (url.hostname === SHOP) return fakeShopify(url, method, headers, body);
  return realFetch(input, init);
};

// ─── Test harness ───────────────────────────────────────────────────────────

const appLogs: string[] = [];
for (const level of ["log", "info", "warn", "error"] as const) {
  console[level] = (...args: unknown[]) => {
    appLogs.push(`[${level}] ${args.map((a) => (a instanceof Error ? a.message : String(a))).join(" ")}`);
  };
}

const failures: string[] = [];
const redact = (text: string) => text.replace(/shp(at|rt|ss)_[A-Za-z0-9_]+/g, "shp$1_***");
function out(line: string) {
  process.stdout.write(`${redact(line)}\n`);
}
function check(label: string, ok: boolean, detail?: unknown) {
  out(`  ${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures.push(label);
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

async function sessionToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ dest: `https://${SHOP}`, sid: randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(`https://${SHOP}/admin`)
    .setAudience(CLIENT_ID)
    .setSubject("1")
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setNotBefore(now - 5)
    .setExpirationTime(now + 60)
    .sign(new TextEncoder().encode(CLIENT_SECRET));
}

function storeRow(): Row {
  const row = stores.find((r) => r.shopify_domain === SHOP);
  if (!row) throw new Error("store row missing");
  return row;
}

/** Mirrors handleAppUninstalled in app/api/webhooks/shopify/route.ts. */
function simulateUninstall() {
  Object.assign(storeRow(), {
    shopify_access_token: null,
    shopify_access_token_expires_at: null,
    shopify_refresh_token: null,
    shopify_refresh_token_expires_at: null,
    shopify_token_refresh_locked_until: null,
    billing_status: "cancelled",
  });
  shopify.currentAccess = null;
  shopify.currentRefresh = null;
}

/** Push the stored access token to `msFromNow` (negative = already expired at Shopify). */
function ageAccessToken(msFromNow: number) {
  const row = storeRow();
  row.shopify_access_token_expires_at = new Date(Date.now() + msFromNow).toISOString();
  if (msFromNow <= 0) shopify.expiredAccess.add(String(row.shopify_access_token));
}

const leaksToken = (text: string) => /shpat_|shprt_/.test(text);

async function main() {
  const { NextRequest } = await import("next/server");
  const dashboardRoute = await import("../app/api/app/dashboard/route");
  const tokenExchangeRoute = await import("../app/api/auth/token-exchange/route");
  const subscribeRoute = await import("../app/api/app/billing/subscribe/route");
  const callbackRoute = await import("../app/api/shopify/billing/callback/route");
  const { getValidShopifyAccessToken } = await import("../lib/shopify/access-token");
  const { resolveShopifyApiSecret, verifyOAuthHmac, verifyWebhookHmacDetailed } = await import(
    "../lib/shopify/config"
  );
  const { brand } = await import("../lib/brand");
  const { SHOPIFY_BILLING_PLANS, inferPlanIdFromSubscriptionName } = await import("../lib/shopify/billing");

  const call = async (
    handler: (req: InstanceType<typeof NextRequest>) => Promise<Response>,
    pathname: string,
    init: { method?: string; body?: unknown; auth?: boolean } = {}
  ) => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (init.auth !== false) headers.authorization = `Bearer ${await sessionToken()}`;
    const req = new NextRequest(`https://app.test${pathname}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const res = await handler(req);
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return { status: res.status, data, text, location: res.headers.get("location") };
  };

  const dashboard = () => call(dashboardRoute.GET, `/api/app/dashboard?shop=${SHOP}`);
  const exchange = () => call(tokenExchangeRoute.POST, "/api/auth/token-exchange", { method: "POST" });
  const subscribe = (planId: string) =>
    call(subscribeRoute.POST, "/api/app/billing/subscribe", {
      method: "POST",
      body: { planId, host: "YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvdGVzdA", shop: SHOP },
    });
  const billingCallback = () =>
    call(callbackRoute.GET, `/api/shopify/billing/callback?shop=${SHOP}&plan=growth&charge_id=1`, { auth: false });

  out("1. Fresh install stores an expiring offline token");
  let res = await dashboard();
  check("dashboard reports needsInstall before any store row exists", res.data.needsInstall === true, res.data);
  res = await exchange();
  check("token exchange creates the store row", res.status === 200 && res.data.ok === true, res.data);
  check("token exchange requested expiring=1", shopify.exchanges.at(-1)?.expiring === "1", shopify.exchanges.at(-1));
  check("token-exchange response never contains a token", !leaksToken(res.text));
  await settle();
  {
    const row = storeRow();
    const expiresIn = Date.parse(String(row.shopify_access_token_expires_at)) - Date.now();
    const refreshExpiresIn = Date.parse(String(row.shopify_refresh_token_expires_at)) - Date.now();
    check("access token stored", row.shopify_access_token === shopify.currentAccess);
    check("access token expiry ~1 hour", expiresIn > 3500_000 && expiresIn <= 3600_000, row.shopify_access_token_expires_at);
    check("refresh token stored", row.shopify_refresh_token === shopify.currentRefresh);
    check("refresh token expiry ~90 days", refreshExpiresIn > 89 * 86400_000, row.shopify_refresh_token_expires_at);
  }
  res = await dashboard();
  check("dashboard is connected after install", res.status === 200 && res.data.needsInstall === false, res.data);
  check("dashboard response never contains a token", !leaksToken(res.text));
  res = await subscribe("starter");
  check("plan selection returns a confirmation URL", res.status === 200 && typeof res.data.confirmationUrl === "string", res.data);
  Object.assign(storeRow(), { billing_status: "active" });

  out("2. Expiring token is refreshed and both tokens rotate");
  {
    const before = { access: storeRow().shopify_access_token, refresh: storeRow().shopify_refresh_token };
    const refreshesBefore = shopify.refreshCalls;
    ageAccessToken(60_000);
    res = await subscribe("growth");
    check("plan selection inside the 5-minute window succeeds", res.status === 200, res.data);
    check("exactly one refresh call", shopify.refreshCalls === refreshesBefore + 1);
    check("access token rotated", storeRow().shopify_access_token !== before.access && storeRow().shopify_access_token === shopify.currentAccess);
    check("refresh token rotated", storeRow().shopify_refresh_token !== before.refresh && storeRow().shopify_refresh_token === shopify.currentRefresh);
    check("subscription used the refreshed token", shopify.subscriptions.at(-1)?.accessToken === shopify.currentAccess);
    check("refresh lock released", storeRow().shopify_token_refresh_locked_until == null, storeRow().shopify_token_refresh_locked_until);
  }
  {
    const refreshesBefore = shopify.refreshCalls;
    ageAccessToken(-1_000);
    res = await billingCallback();
    check("billing callback refreshes an expired token", shopify.refreshCalls === refreshesBefore + 1);
    check("billing callback synced the subscription", storeRow().billing_status === "active", storeRow().billing_status);
  }
  {
    const refreshesBefore = shopify.refreshCalls;
    ageAccessToken(-1_000);
    const results = await Promise.all([1, 2, 3].map(() => getValidShopifyAccessToken(String(storeRow().id))));
    check("3 concurrent callers all get a token", results.every((r) => r.ok), results.map((r) => (r.ok ? "ok" : r.reason)));
    check("concurrent callers trigger only one refresh", shopify.refreshCalls === refreshesBefore + 1, shopify.refreshCalls - refreshesBefore);
    check(
      "concurrent callers all receive the rotated token",
      results.every((r) => r.ok && r.accessToken === shopify.currentAccess)
    );
  }

  out("3. Misconfigured client secret keeps the refresh token");
  {
    const before = storeRow().shopify_refresh_token;
    shopify.refreshRejectsClient = true;
    ageAccessToken(-1_000);
    const result = await getValidShopifyAccessToken(String(storeRow().id));
    shopify.refreshRejectsClient = false;
    check("400 from refresh reports unavailable", !result.ok && result.reason === "unavailable", result);
    check("refresh token kept for a later retry", storeRow().shopify_refresh_token === before);
    const retry = await getValidShopifyAccessToken(String(storeRow().id));
    check("retry with the same refresh token succeeds", retry.ok, retry);
  }

  out("4. Refresh failure (401) → needsInstall → recovered by token exchange");
  {
    shopify.currentRefresh = "shprt_revoked";
    ageAccessToken(-1_000);
    const result = await getValidShopifyAccessToken(String(storeRow().id));
    check("refresh rejected → refresh_failed", !result.ok && result.reason === "refresh_failed", result);
    check(
      "tokens and expiries cleared",
      storeRow().shopify_access_token == null &&
        storeRow().shopify_refresh_token == null &&
        storeRow().shopify_access_token_expires_at == null &&
        storeRow().shopify_refresh_token_expires_at == null,
      storeRow()
    );
    res = await dashboard();
    check("dashboard reports needsInstall", res.data.needsInstall === true, res.data);
    res = await subscribe("starter");
    check('plan selection recovers via token exchange (no "Store is not connected")', res.status === 200 && !/not connected/i.test(res.text), res.data);
    check("store has a fresh expiring token again", storeRow().shopify_access_token === shopify.currentAccess && storeRow().shopify_refresh_token === shopify.currentRefresh);
  }

  out("5. Legacy non-expiring token (expires_at null)");
  {
    Object.assign(storeRow(), {
      shopify_access_token: "shpat_legacy_old",
      shopify_access_token_expires_at: null,
      shopify_refresh_token: null,
      shopify_refresh_token_expires_at: null,
    });
    const legacyCallsBefore = shopify.legacyTokenAdminCalls;
    res = await dashboard();
    check("dashboard reports needsInstall", res.data.needsInstall === true, res.data);
    const result = await getValidShopifyAccessToken(String(storeRow().id));
    check("helper reports needs_token_exchange (no error thrown)", !result.ok && result.reason === "needs_token_exchange", result);
    res = await subscribe("growth");
    check("plan selection succeeds via token exchange", res.status === 200, res.data);
    check("legacy token never sent to the Admin API", shopify.legacyTokenAdminCalls === legacyCallsBefore);
    check("legacy token replaced by an expiring one", storeRow().shopify_access_token_expires_at != null && storeRow().shopify_refresh_token != null);
  }

  out("6. Uninstall clears every token column");
  simulateUninstall();
  check("tokens cleared, row kept", storeRow().shopify_access_token === null && storeRow().billing_status === "cancelled");

  out("7. Reinstall, worst case: plan picked before the client runs token exchange");
  res = await dashboard();
  check("dashboard reports needsInstall when the row has no token", res.data.needsInstall === true, res.data);
  check("dashboard response never contains a token", !leaksToken(res.text));
  const exchangesBefore = shopify.issued;
  res = await subscribe("growth");
  check(
    'plan selection succeeds (no "Store is not connected")',
    res.status === 200 && typeof res.data.confirmationUrl === "string" && !/not connected/i.test(res.text),
    { status: res.status, body: res.data }
  );
  check("subscribe ran the shared token exchange itself", shopify.issued === exchangesBefore + 1);
  check(
    "subscription was created with the new token",
    shopify.subscriptions.at(-1)?.accessToken === shopify.currentAccess && storeRow().shopify_access_token === shopify.currentAccess
  );
  check(
    "store now tracks the new plan as pending",
    storeRow().billing_plan === "growth" && storeRow().billing_status === "pending" &&
      storeRow().shopify_subscription_id === shopify.subscriptions.at(-1)?.id,
    storeRow()
  );
  await settle();

  out("8. Uninstall + reinstall, normal client path (dashboard → token exchange → plan)");
  Object.assign(storeRow(), { billing_status: "active" });
  simulateUninstall();
  res = await dashboard();
  check("dashboard reports needsInstall", res.data.needsInstall === true, res.data);
  res = await exchange();
  check("token exchange succeeds on reinstall", res.status === 200 && res.data.ok === true, res.data);
  check(
    "stale billing from the old install is reset",
    storeRow().billing_plan === null && storeRow().shopify_subscription_id === null &&
      storeRow().billing_status === "pending",
    storeRow()
  );
  check("reinstall stored an expiring token + refresh token", storeRow().shopify_access_token_expires_at != null && storeRow().shopify_refresh_token === shopify.currentRefresh);
  await settle();
  res = await dashboard();
  check("dashboard is connected again", res.data.needsInstall === false, res.data);
  res = await subscribe("scale");
  check('plan selection succeeds (no "Store is not connected")', res.status === 200 && !/not connected/i.test(res.text), {
    status: res.status,
    body: res.data,
  });

  out("9. Test-charge mode in production (SHOPIFY_BILLING_TEST unset)");
  check("development store gets test: true", shopify.subscriptions.at(-1)?.test === true, shopify.subscriptions.at(-1));
  shopify.partnerDevelopment = false;
  res = await subscribe("starter");
  check("paid store gets test: false", res.status === 200 && shopify.subscriptions.at(-1)?.test === false, shopify.subscriptions.at(-1));
  shopify.planLookupFails = true;
  res = await subscribe("starter");
  check("plan lookup failure falls back to test: false", res.status === 200 && shopify.subscriptions.at(-1)?.test === false, shopify.subscriptions.at(-1));

  out("10. Legacy unauthenticated route");
  check(
    "app/api/shopify/billing/subscribe/route.ts is removed",
    !existsSync(path.join(process.cwd(), "app/api/shopify/billing/subscribe/route.ts"))
  );

  out("11. Single client secret source (SHOPIFY_API_SECRET → SHOPIFY_CLIENT_SECRET)");
  const mismatchWarnings = () =>
    appLogs.filter((line) => line.startsWith("[warn]") && line.includes("both set but differ")).length;
  const setSecrets = (api: string | null, client: string | null) => {
    if (api === null) delete process.env.SHOPIFY_API_SECRET;
    else process.env.SHOPIFY_API_SECRET = api;
    if (client === null) delete process.env.SHOPIFY_CLIENT_SECRET;
    else process.env.SHOPIFY_CLIENT_SECRET = client;
  };
  const webhookBody = JSON.stringify({ id: 1, shop_domain: SHOP });
  const sign = (secret: string) => createHmac("sha256", secret).update(webhookBody, "utf8").digest("base64");

  check("no mismatch warning while both vars are equal", mismatchWarnings() === 0, mismatchWarnings());

  // Production scenario: SHOPIFY_CLIENT_SECRET holds a stale value.
  setSecrets(CLIENT_SECRET, STALE_SECRET);
  check("SHOPIFY_API_SECRET wins when both are set", resolveShopifyApiSecret().source === "SHOPIFY_API_SECRET");
  res = await exchange();
  check("token exchange uses SHOPIFY_API_SECRET (stale SHOPIFY_CLIENT_SECRET ignored)", res.status === 200 && res.data.ok === true, res.data);
  {
    const refreshesBefore = shopify.refreshCalls;
    ageAccessToken(-1_000);
    const result = await getValidShopifyAccessToken(String(storeRow().id));
    check("token refresh uses SHOPIFY_API_SECRET", result.ok && shopify.refreshCalls === refreshesBefore + 1, result);
  }
  res = await dashboard();
  check("session-token JWT verifies with SHOPIFY_API_SECRET", res.status === 200 && res.data.needsInstall === false, res.data);
  {
    const ok = verifyWebhookHmacDetailed(webhookBody, sign(CLIENT_SECRET));
    check("webhook HMAC verifies with SHOPIFY_API_SECRET", ok.ok && ok.secretSource === "SHOPIFY_API_SECRET", ok);
    const stale = verifyWebhookHmacDetailed(webhookBody, sign(STALE_SECRET));
    check("webhook HMAC signed with the stale secret is rejected", !stale.ok && stale.reason === "hmac_mismatch", stale);
    const query = new URLSearchParams({ shop: SHOP, timestamp: "1700000000" });
    query.set("hmac", createHmac("sha256", CLIENT_SECRET).update(query.toString()).digest("hex"));
    check("OAuth HMAC verifies with SHOPIFY_API_SECRET", verifyOAuthHmac(query));
  }
  check("mismatch warning logged exactly once", mismatchWarnings() === 1, mismatchWarnings());
  {
    const warning = appLogs.find((line) => line.includes("both set but differ")) ?? "";
    check(
      "mismatch warning names both vars",
      warning.includes("SHOPIFY_API_SECRET") && warning.includes("SHOPIFY_CLIENT_SECRET")
    );
  }

  setSecrets(null, CLIENT_SECRET);
  check("falls back to SHOPIFY_CLIENT_SECRET when SHOPIFY_API_SECRET is unset", resolveShopifyApiSecret().source === "SHOPIFY_CLIENT_SECRET");
  res = await exchange();
  check("token exchange works with only SHOPIFY_CLIENT_SECRET", res.status === 200 && res.data.ok === true, res.data);
  res = await dashboard();
  check("session-token JWT verifies with only SHOPIFY_CLIENT_SECRET", res.status === 200 && res.data.needsInstall === false, res.data);

  setSecrets(`  "${CLIENT_SECRET}"\n`, CLIENT_SECRET);
  res = await exchange();
  check("quoted/whitespace SHOPIFY_API_SECRET is cleaned (JWT + exchange)", res.status === 200 && res.data.ok === true, res.data);
  {
    const ok = verifyWebhookHmacDetailed(webhookBody, sign(CLIENT_SECRET));
    check("quoted/whitespace secret verifies webhook HMAC", ok.ok, ok);
  }
  check("cleaned values that match do not warn again", mismatchWarnings() === 1, mismatchWarnings());

  setSecrets(null, null);
  {
    const none = resolveShopifyApiSecret();
    check("no secret configured → empty secret, null source", none.secret === "" && none.source === null, none.source);
    const missing = verifyWebhookHmacDetailed(webhookBody, sign(CLIENT_SECRET));
    check("webhook HMAC reports missing_secret", !missing.ok && missing.reason === "missing_secret", missing);
  }
  setSecrets(CLIENT_SECRET, CLIENT_SECRET);

  check(
    "no app log line contains a secret value",
    !appLogs.some((line) => line.includes(CLIENT_SECRET) || line.includes(STALE_SECRET))
  );

  out("12. Brand config (lib/brand.ts) and billing plan names");
  check(
    "defaults keep the CartRenew brand",
    brand.name === "CartRenew" &&
      brand.title === "CartRenew — WhatsApp Cart Recovery" &&
      brand.supportEmail === "contact@cartrenew.com" &&
      brand.appUrl === "https://www.cartrenew.com" &&
      brand.appHost === "cartrenew.com" &&
      brand.logo.primary === "Cart" &&
      brand.logo.accent === "Renew" &&
      brand.isDefault,
    brand
  );
  check(
    "default plan names are unchanged",
    SHOPIFY_BILLING_PLANS.starter.name === "CartRenew Starter" &&
      SHOPIFY_BILLING_PLANS.growth.name === "CartRenew Growth" &&
      SHOPIFY_BILLING_PLANS.scale.name === "CartRenew Scale",
    Object.values(SHOPIFY_BILLING_PLANS).map((p) => p.name)
  );
  check(
    "plan labels are Starter/Growth/Scale",
    SHOPIFY_BILLING_PLANS.starter.label === "Starter" &&
      SHOPIFY_BILLING_PLANS.growth.label === "Growth" &&
      SHOPIFY_BILLING_PLANS.scale.label === "Scale"
  );
  check(
    "appSubscriptionCreate received the plan name",
    shopify.subscriptions.length > 0 &&
      shopify.subscriptions.every((s) =>
        Object.values(SHOPIFY_BILLING_PLANS).some((p) => p.name === s.name)
      ),
    shopify.subscriptions.map((s) => s.name)
  );
  check(
    "plan is inferred from old and branded subscription names",
    inferPlanIdFromSubscriptionName("CartRenew Growth") === "growth" &&
      inferPlanIdFromSubscriptionName("Pingza Scale") === "scale" &&
      inferPlanIdFromSubscriptionName("Pingza Starter") === "starter"
  );

  const brandInChild = (env: Partial<Record<(typeof BRAND_ENV_KEYS)[number], string>>) => {
    const code = [
      'const { brand } = await import("./lib/brand.ts");',
      'const billing = await import("./lib/shopify/billing.ts");',
      "const plans = Object.values(billing.SHOPIFY_BILLING_PLANS);",
      "console.log(JSON.stringify({ brand, names: plans.map((p) => p.name),",
      "  inferred: plans.map((p) => billing.inferPlanIdFromSubscriptionName(p.name)) }));",
    ].join("\n");
    const childEnv: NodeJS.ProcessEnv = { ...process.env };
    for (const key of BRAND_ENV_KEYS) delete childEnv[key];
    Object.assign(childEnv, env);
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", code],
      { cwd: process.cwd(), env: childEnv, encoding: "utf8" }
    );
    if (result.status !== 0) throw new Error(`brand child process failed: ${result.stderr}`);
    return JSON.parse(result.stdout.trim().split("\n").at(-1) ?? "{}") as {
      brand: typeof brand;
      names: string[];
      inferred: string[];
    };
  };

  {
    const custom = brandInChild({
      NEXT_PUBLIC_APP_NAME: '  "Pingza" ',
      NEXT_PUBLIC_APP_TAGLINE: "Abandoned Cart Recovery",
      NEXT_PUBLIC_SUPPORT_EMAIL: "help@pingza.test",
      NEXT_PUBLIC_APP_URL: "https://www.pingza.test/",
    });
    check("NEXT_PUBLIC_APP_NAME is cleaned and used", custom.brand.name === "Pingza" && !custom.brand.isDefault, custom.brand);
    check("title combines name and tagline", custom.brand.title === "Pingza — Abandoned Cart Recovery", custom.brand.title);
    check(
      "support email, app URL and host come from env",
      custom.brand.supportEmail === "help@pingza.test" &&
        custom.brand.appUrl === "https://www.pingza.test" &&
        custom.brand.appHost === "pingza.test",
      custom.brand
    );
    check("custom brand logo is the full name", custom.brand.logo.primary === "Pingza" && custom.brand.logo.accent === "", custom.brand.logo);
    check(
      "plan names follow the brand",
      JSON.stringify(custom.names) === JSON.stringify(["Pingza Starter", "Pingza Growth", "Pingza Scale"]),
      custom.names
    );
    check(
      "branded plan names map back to plan ids",
      JSON.stringify(custom.inferred) === JSON.stringify(["starter", "growth", "scale"]),
      custom.inferred
    );
  }
  {
    const blank = brandInChild({
      NEXT_PUBLIC_APP_NAME: "   ",
      NEXT_PUBLIC_APP_TAGLINE: '""',
      NEXT_PUBLIC_SUPPORT_EMAIL: "",
      NEXT_PUBLIC_APP_URL: " ",
    });
    check(
      "blank or quoted-empty env values fall back to CartRenew defaults",
      blank.brand.name === "CartRenew" &&
        blank.brand.title === "CartRenew — WhatsApp Cart Recovery" &&
        blank.brand.supportEmail === "contact@cartrenew.com" &&
        blank.brand.appUrl === "https://www.cartrenew.com" &&
        blank.brand.isDefault,
      blank.brand
    );
  }
}

main()
  .catch((error) => {
    failures.push(`unexpected error: ${error instanceof Error ? error.stack : String(error)}`);
  })
  .finally(() => {
    if (failures.length > 0) {
      out(`\n${failures.length} check(s) failed:`);
      failures.forEach((f) => out(`  - ${f}`));
      out("\nApp logs:");
      appLogs.forEach((line) => out(`  ${line}`));
      process.exit(1);
    }
    out("\nAll checks passed.");
    process.exit(0);
  });
