/**
 * Regression: install → uninstall (token cleared) → reinstall → plan selection
 * must never fail with "Store is not connected".
 *
 * Runs the real route handlers in-process. Global fetch is stubbed with an
 * in-memory Supabase `stores` table and a fake Shopify Admin API, so nothing
 * touches the network or a real database.
 *
 *   npm run test:shopify-reinstall
 */

import { randomUUID } from "crypto";
import { existsSync } from "fs";
import path from "path";
import { SignJWT } from "jose";

const SHOP = "reinstall-review-store.myshopify.com";
const CLIENT_ID = "test-client-id";
const CLIENT_SECRET = "shpss_test_secret";

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

// ─── Fake infrastructure ────────────────────────────────────────────────────

type Row = Record<string, unknown>;

const stores: Row[] = [];

const shopify = {
  partnerDevelopment: true,
  planLookupFails: false,
  validToken: null as string | null,
  issued: 0,
  subscriptions: [] as Array<{ id: string; test: unknown; accessToken: string }>,
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

function matchesFilters(row: Row, params: URLSearchParams): boolean {
  for (const [key, value] of params) {
    if (["select", "on_conflict", "limit", "order"].includes(key)) continue;
    if (value.startsWith("eq.")) {
      if (String(row[key] ?? "") !== value.slice(3)) return false;
    }
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

function fakeShopify(url: URL, method: string, headers: Headers, body: string | null): Response {
  if (url.pathname === "/admin/oauth/access_token" && method === "POST") {
    const form = new URLSearchParams(body ?? "");
    if (
      form.get("client_id") !== CLIENT_ID ||
      form.get("client_secret") !== CLIENT_SECRET ||
      form.get("grant_type") !== "urn:ietf:params:oauth:grant-type:token-exchange" ||
      !form.get("subject_token")
    ) {
      return json({ error: "invalid_request" }, 400);
    }
    shopify.issued += 1;
    shopify.validToken = `shpat_test_${shopify.issued}`;
    return json({ access_token: shopify.validToken, scope: "read_orders" });
  }

  if (headers.get("x-shopify-access-token") !== shopify.validToken || !shopify.validToken) {
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
    if (query.includes("ValidateOfflineAccessToken")) {
      return json({ data: { shop: { id: "gid://shopify/Shop/1" } } });
    }
    if (query.includes("partnerDevelopment")) {
      if (shopify.planLookupFails) return json({ errors: "Internal error" }, 500);
      return json({ data: { shop: { plan: { partnerDevelopment: shopify.partnerDevelopment } } } });
    }
    if (query.includes("appSubscriptionCreate")) {
      const id = `gid://shopify/AppSubscription/${shopify.subscriptions.length + 1}`;
      shopify.subscriptions.push({ id, test: variables?.test, accessToken: shopify.validToken });
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
function out(line: string) {
  process.stdout.write(`${line}\n`);
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

function storeRow(): Row | undefined {
  return stores.find((row) => row.shopify_domain === SHOP);
}

/** Mirrors handleAppUninstalled in app/api/webhooks/shopify/route.ts. */
function simulateUninstall() {
  const row = storeRow();
  if (row) Object.assign(row, { shopify_access_token: null, billing_status: "cancelled" });
  shopify.validToken = null;
}

async function main() {
  const { NextRequest } = await import("next/server");
  const dashboardRoute = await import("../app/api/app/dashboard/route");
  const tokenExchangeRoute = await import("../app/api/auth/token-exchange/route");
  const subscribeRoute = await import("../app/api/app/billing/subscribe/route");

  const call = async (
    handler: (req: InstanceType<typeof NextRequest>) => Promise<Response>,
    pathname: string,
    init: { method?: string; body?: unknown } = {}
  ) => {
    const req = new NextRequest(`https://app.test${pathname}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${await sessionToken()}`,
        "content-type": "application/json",
      },
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
    return { status: res.status, data, text };
  };

  const dashboard = () => call(dashboardRoute.GET, `/api/app/dashboard?shop=${SHOP}`);
  const exchange = () => call(tokenExchangeRoute.POST, "/api/auth/token-exchange", { method: "POST" });
  const subscribe = (planId: string) =>
    call(subscribeRoute.POST, "/api/app/billing/subscribe", {
      method: "POST",
      body: { planId, host: "YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvdGVzdA", shop: SHOP },
    });

  out("1. Fresh install");
  let res = await dashboard();
  check("dashboard reports needsInstall before any store row exists", res.data.needsInstall === true, res.data);
  res = await exchange();
  check("token exchange creates the store row", res.status === 200 && res.data.ok === true, res.data);
  await settle();
  check("store row has an offline token", Boolean(storeRow()?.shopify_access_token));
  res = await dashboard();
  check("dashboard is connected after install", res.status === 200 && res.data.needsInstall === false, res.data);
  res = await subscribe("starter");
  check("plan selection returns a confirmation URL", res.status === 200 && typeof res.data.confirmationUrl === "string", res.data);
  Object.assign(storeRow() ?? {}, {
    billing_status: "active",
    billing_current_period_end: "2026-10-31T00:00:00.000Z",
  });

  out("2. Connected-store token refresh");
  const activeBilling = {
    status: storeRow()?.billing_status,
    plan: storeRow()?.billing_plan,
    subscriptionId: storeRow()?.shopify_subscription_id,
    periodEnd: storeRow()?.billing_current_period_end,
  };
  res = await exchange();
  check("token exchange succeeds for a connected store", res.status === 200 && res.data.ok === true, res.data);
  check(
    "connected-store token refresh preserves active billing",
    storeRow()?.billing_status === activeBilling.status &&
      storeRow()?.billing_plan === activeBilling.plan &&
      storeRow()?.shopify_subscription_id === activeBilling.subscriptionId &&
      storeRow()?.billing_current_period_end === activeBilling.periodEnd,
    storeRow()
  );
  await settle();

  out("3. Uninstall (app/uninstalled clears the token)");
  simulateUninstall();
  check("token cleared, row kept", storeRow()?.shopify_access_token === null && storeRow()?.billing_status === "cancelled");

  out("4. Reinstall, worst case: plan picked before the client runs token exchange");
  res = await dashboard();
  check("dashboard reports needsInstall when the row has no token", res.data.needsInstall === true, res.data);
  check("dashboard response never contains an access token", !/shpat_/.test(res.text), res.text);
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
    shopify.subscriptions.at(-1)?.accessToken === shopify.validToken && storeRow()?.shopify_access_token === shopify.validToken
  );
  check(
    "store now tracks the new plan as pending",
    storeRow()?.billing_plan === "growth" && storeRow()?.billing_status === "pending" &&
      storeRow()?.shopify_subscription_id === shopify.subscriptions.at(-1)?.id,
    storeRow()
  );
  await settle();

  out("5. Uninstall + reinstall, normal client path (dashboard → token exchange → plan)");
  Object.assign(storeRow() ?? {}, { billing_status: "active" });
  simulateUninstall();
  res = await dashboard();
  check("dashboard reports needsInstall", res.data.needsInstall === true, res.data);
  res = await exchange();
  check("token exchange succeeds on reinstall", res.status === 200 && res.data.ok === true, res.data);
  check(
    "stale billing from the old install is reset",
    storeRow()?.billing_plan === null && storeRow()?.shopify_subscription_id === null &&
      storeRow()?.billing_status === "pending",
    storeRow()
  );
  await settle();
  res = await dashboard();
  check("dashboard is connected again", res.data.needsInstall === false, res.data);
  res = await subscribe("scale");
  check('plan selection succeeds (no "Store is not connected")', res.status === 200 && !/not connected/i.test(res.text), {
    status: res.status,
    body: res.data,
  });

  out("6. Reinstall after Shopify invalidates the token but app/uninstalled is missed");
  const staleToken = storeRow()?.shopify_access_token;
  Object.assign(storeRow() ?? {}, {
    billing_status: "active",
    billing_plan: "scale",
    shopify_subscription_id: "gid://shopify/AppSubscription/stale",
    billing_current_period_end: "2026-11-01T00:00:00.000Z",
  });
  shopify.validToken = null;
  check(
    "missed webhook leaves the stale token and active billing metadata in the store row",
    Boolean(staleToken) && storeRow()?.billing_status === "active" && shopify.validToken === null,
    storeRow()
  );
  res = await exchange();
  check("Shopify issues and stores a different offline token", res.status === 200 && storeRow()?.shopify_access_token !== staleToken, {
    status: res.status,
    body: res.data,
  });
  check(
    "stale billing is reset after a missed-webhook reinstall",
    storeRow()?.billing_plan === null && storeRow()?.shopify_subscription_id === null &&
      storeRow()?.billing_current_period_end === null && storeRow()?.billing_status === "pending",
    storeRow()
  );
  await settle();

  out("7. Test-charge mode in production (SHOPIFY_BILLING_TEST unset)");
  check("development store gets test: true", shopify.subscriptions.at(-1)?.test === true, shopify.subscriptions.at(-1));
  shopify.partnerDevelopment = false;
  res = await subscribe("starter");
  check("paid store gets test: false", res.status === 200 && shopify.subscriptions.at(-1)?.test === false, shopify.subscriptions.at(-1));
  shopify.planLookupFails = true;
  res = await subscribe("starter");
  check("plan lookup failure falls back to test: false", res.status === 200 && shopify.subscriptions.at(-1)?.test === false, shopify.subscriptions.at(-1));

  out("8. Legacy unauthenticated route");
  check(
    "app/api/shopify/billing/subscribe/route.ts is removed",
    !existsSync(path.join(process.cwd(), "app/api/shopify/billing/subscribe/route.ts"))
  );
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
