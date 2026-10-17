import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  isInactiveBillingStatus,
  pickActiveSubscription,
  resolveBillingPlanId,
  shouldApplySubscriptionWebhook,
  shouldSyncBillingOnDashboard,
} from "../lib/shopify/billing-sync"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SHOP = "cartrenew-empty-test.myshopify.com"

test("inactive billing statuses cover schema default NONE and cancelled", () => {
  assert.equal(isInactiveBillingStatus("NONE"), true)
  assert.equal(isInactiveBillingStatus("none"), true)
  assert.equal(isInactiveBillingStatus(null), true)
  assert.equal(isInactiveBillingStatus("cancelled"), true)
  assert.equal(isInactiveBillingStatus("active"), false)
  assert.equal(isInactiveBillingStatus("pending"), false)
})

test("pickActiveSubscription prefers ACTIVE (trial) over stale ids", () => {
  const subs = [
    { id: "gid://old", name: "Pingza Starter", status: "CANCELLED", currentPeriodEnd: null },
    { id: "gid://new", name: "Pingza Starter", status: "ACTIVE", currentPeriodEnd: null },
  ]
  // Never prefer a cancelled preferred id over a live ACTIVE subscription.
  assert.equal(pickActiveSubscription(subs, "gid://old")?.id, "gid://new")
  assert.equal(pickActiveSubscription(subs, "gid://new")?.id, "gid://new")
  assert.equal(pickActiveSubscription(subs, null)?.id, "gid://new")
  assert.equal(pickActiveSubscription([], null), null)
})

test("stale inactive subscription webhooks are ignored unless they match current id", () => {
  assert.equal(
    shouldApplySubscriptionWebhook({
      billingStatus: "cancelled",
      webhookSubscriptionId: "gid://old",
      currentSubscriptionId: "gid://new",
    }),
    false
  )
  assert.equal(
    shouldApplySubscriptionWebhook({
      billingStatus: "none",
      webhookSubscriptionId: "gid://old",
      currentSubscriptionId: null,
    }),
    false,
    "after reinstall current id is null — do not write NONE from a stale webhook"
  )
  assert.equal(
    shouldApplySubscriptionWebhook({
      billingStatus: "cancelled",
      webhookSubscriptionId: "gid://cur",
      currentSubscriptionId: "gid://cur",
    }),
    true
  )
  assert.equal(
    shouldApplySubscriptionWebhook({
      billingStatus: "active",
      webhookSubscriptionId: "gid://new",
      currentSubscriptionId: "gid://old",
    }),
    true,
    "ACTIVE updates always apply"
  )
})

test("resolveBillingPlanId prefers return-URL plan then subscription name", () => {
  assert.equal(resolveBillingPlanId({ preferredPlan: "starter" }), "starter")
  assert.equal(resolveBillingPlanId({ subscriptionName: "Pingza Growth" }), "growth")
  assert.equal(resolveBillingPlanId({ existingPlan: "scale" }), "scale")
  assert.equal(resolveBillingPlanId({}), null)
})

test("shouldSyncBillingOnDashboard is Pingza-only for billing=ok or NONE", () => {
  assert.equal(
    shouldSyncBillingOnDashboard({ isDefaultBrand: true, billingOk: true, billingStatus: "NONE" }),
    false,
    "CartRenew never syncs on dashboard"
  )
  assert.equal(
    shouldSyncBillingOnDashboard({ isDefaultBrand: false, billingOk: true, billingStatus: "pending" }),
    true
  )
  assert.equal(
    shouldSyncBillingOnDashboard({ isDefaultBrand: false, billingOk: false, billingStatus: "NONE" }),
    true
  )
  assert.equal(
    shouldSyncBillingOnDashboard({ isDefaultBrand: false, billingOk: false, billingStatus: "active" }),
    false
  )
})

const CHILD = `
  const storesByDomain = new Map()
  const storesById = new Map()
  const requests = []
  let activeSubscriptions = []
  const json = (value, status = 200) =>
    new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } })
  const putStore = (row) => {
    storesByDomain.set(row.shopify_domain, row)
    storesById.set(row.id, row)
  }
  const findStore = (url) => {
    const params = new URL(url).searchParams
    const domain = params.get("shopify_domain") || ""
    if (domain) {
      const key = domain.startsWith("eq.") ? domain.slice(3) : domain
      return storesByDomain.get(key) || null
    }
    const id = params.get("id") || ""
    if (id) {
      const key = id.startsWith("eq.") ? id.slice(3) : id
      return storesById.get(key) || null
    }
    return [...storesByDomain.values()][0] || null
  }
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url ?? String(input)
    const method = (init.method || "GET").toUpperCase()
    const body = typeof init.body === "string" ? init.body : null
    requests.push({ url, method, body })
    if (url.includes("/admin/api/") && url.includes("graphql")) {
      const payload = body ? JSON.parse(body) : {}
      if (String(payload.query || "").includes("activeSubscriptions")) {
        return json({ data: { currentAppInstallation: { activeSubscriptions } } })
      }
      return json({ data: {} })
    }
    if (url.includes("/rest/v1/stores")) {
      const accept = new Headers(init.headers).get("accept") || ""
      const one = (row) => (accept.includes("vnd.pgrst.object") ? json(row) : json(row ? [row] : []))
      if (method === "GET") return one(findStore(url))
      if (method === "PATCH" || method === "POST") {
        const row = findStore(url)
        if (!row) return json({ message: "not found" }, 404)
        Object.assign(row, body ? JSON.parse(body) : {})
        putStore(row)
        return one(row)
      }
    }
    // abandoned_carts / analytics_daily — empty is fine
    return json([])
  }
  const load = async (file) => {
    const mod = await import(file)
    return { ...(mod.default ?? {}), ...mod }
  }
`

function runChild(appName: string, script: string, env: Record<string, string> = {}) {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", `${CHILD}\n${script}`],
    {
      cwd: root,
      env: {
        ...process.env,
        NEXT_PUBLIC_APP_NAME: appName,
        NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
        SHOPIFY_API_KEY: "test-client-id",
        SHOPIFY_API_SECRET: "test-secret",
        SHOPIFY_APP_URL: "https://app.pingza.test",
        ...env,
      },
      encoding: "utf8",
    }
  )
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  const line = result.stdout.split(/\r?\n/).find((l) => l.startsWith("RESULT:"))
  assert.ok(line, `${result.stdout}\n${result.stderr}`)
  return { out: JSON.parse(line.slice("RESULT:".length)), logs: result.stdout + result.stderr }
}

test("Pingza: billing=ok syncs a live ACTIVE subscription after reinstall NONE", () => {
  const { out, logs } = runChild(
    "Pingza",
    `
      const shop = "${SHOP}"
      putStore({
        id: "store-1",
        shopify_domain: shop,
        billing_status: "NONE",
        billing_plan: null,
        shopify_subscription_id: null,
        shopify_access_token: "shpat_live",
        shopify_access_token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
        shopify_refresh_token: "shprt_live",
        shopify_refresh_token_expires_at: new Date(Date.now() + 86400_000).toISOString(),
      })
      activeSubscriptions = [{
        id: "gid://shopify/AppSubscription/99",
        name: "Pingza Starter",
        status: "ACTIVE",
        currentPeriodEnd: null,
        trialDays: 7,
      }]
      const { GET } = await load("./app/api/app/dashboard/route.ts")
      const { NextRequest } = await import("next/server")
      const { SignJWT } = await import("jose")
      const token = await new SignJWT({ dest: "https://" + shop })
        .setProtectedHeader({ alg: "HS256" })
        .setAudience("test-client-id")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(new TextEncoder().encode("test-secret"))
      const res = await GET(new NextRequest(
        "http://localhost/api/app/dashboard?shop=" + shop + "&billing=ok&plan=starter",
        { headers: { authorization: "Bearer " + token } }
      ))
      const body = await res.json()
      console.log("RESULT:" + JSON.stringify({
        status: res.status,
        billing_status: body.store?.billing_status,
        billing_plan: body.store?.billing_plan,
        subId: storesByDomain.get(shop).shopify_subscription_id,
        graphql: requests.filter((r) => r.url.includes("graphql")).length,
      }))
    `
  )

  assert.equal(out.status, 200)
  assert.equal(out.billing_status, "active")
  assert.equal(out.billing_plan, "starter")
  assert.equal(out.subId, "gid://shopify/AppSubscription/99")
  assert.ok(out.graphql >= 1)
  assert.match(logs, /\[billing-sync\].*source=shopify/)
  assert.match(logs, /activeSubscriptions=1/)
  assert.equal(logs.includes("shpat_"), false)
})

test("CartRenew: dashboard does not sync billing from Shopify when status is NONE", () => {
  const { out, logs } = runChild(
    "CartRenew",
    `
      const shop = "${SHOP}"
      putStore({
        id: "store-1",
        shopify_domain: shop,
        billing_status: "NONE",
        billing_plan: null,
        shopify_subscription_id: null,
        shopify_access_token: "shpat_live",
        shopify_access_token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
        shopify_refresh_token: "shprt_live",
        shopify_refresh_token_expires_at: new Date(Date.now() + 86400_000).toISOString(),
      })
      activeSubscriptions = [{
        id: "gid://shopify/AppSubscription/1",
        name: "CartRenew Starter",
        status: "ACTIVE",
        currentPeriodEnd: null,
        trialDays: 0,
      }]
      const { GET } = await load("./app/api/app/dashboard/route.ts")
      const { NextRequest } = await import("next/server")
      const { SignJWT } = await import("jose")
      const token = await new SignJWT({ dest: "https://" + shop })
        .setProtectedHeader({ alg: "HS256" })
        .setAudience("test-client-id")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(new TextEncoder().encode("test-secret"))
      const res = await GET(new NextRequest(
        "http://localhost/api/app/dashboard?shop=" + shop + "&billing=ok&plan=starter",
        { headers: { authorization: "Bearer " + token } }
      ))
      const body = await res.json()
      console.log("RESULT:" + JSON.stringify({
        status: res.status,
        billing_status: body.store?.billing_status,
        billing_plan: body.store?.billing_plan,
        graphql: requests.filter((r) => r.url.includes("graphql")).length,
      }))
    `
  )

  assert.equal(out.status, 200)
  assert.equal(out.billing_status, "NONE", "CartRenew DB row unchanged")
  assert.equal(out.billing_plan, null)
  assert.equal(out.graphql, 0, "no Shopify billing query")
  assert.equal(logs.includes("[billing-sync]"), false)
})

test("Pingza: billing=ok retries when activeSubscriptions is empty then ACTIVE", () => {
  const { out, logs } = runChild(
    "Pingza",
    `
      const shop = "${SHOP}"
      putStore({
        id: "store-1",
        shopify_domain: shop,
        billing_status: "NONE",
        billing_plan: null,
        shopify_subscription_id: null,
        shopify_access_token: "shpat_live",
        shopify_access_token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
        shopify_refresh_token: "shprt_live",
        shopify_refresh_token_expires_at: new Date(Date.now() + 86400_000).toISOString(),
      })
      let polls = 0
      // Override fetch wrapper: first GraphQL poll empty, then ACTIVE (Shopify lag after approve).
      const inner = globalThis.fetch
      globalThis.fetch = async (input, init = {}) => {
        const url = typeof input === "string" ? input : input.url ?? String(input)
        const body = typeof init.body === "string" ? init.body : null
        if (url.includes("graphql") && String(body || "").includes("activeSubscriptions")) {
          polls += 1
          activeSubscriptions = polls < 2
            ? []
            : [{
                id: "gid://shopify/AppSubscription/55",
                name: "Pingza Starter",
                status: "ACTIVE",
                currentPeriodEnd: null,
                trialDays: 7,
              }]
        }
        return inner(input, init)
      }
      const { GET } = await load("./app/api/app/dashboard/route.ts")
      const { NextRequest } = await import("next/server")
      const { SignJWT } = await import("jose")
      const token = await new SignJWT({ dest: "https://" + shop })
        .setProtectedHeader({ alg: "HS256" })
        .setAudience("test-client-id")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(new TextEncoder().encode("test-secret"))
      const res = await GET(new NextRequest(
        "http://localhost/api/app/dashboard?shop=" + shop + "&billing=ok&plan=starter",
        { headers: { authorization: "Bearer " + token } }
      ))
      const body = await res.json()
      console.log("RESULT:" + JSON.stringify({
        status: res.status,
        billing_status: body.store?.billing_status,
        billing_plan: body.store?.billing_plan,
        polls,
      }))
    `
  )

  assert.equal(out.status, 200)
  assert.equal(out.billing_status, "active")
  assert.equal(out.billing_plan, "starter")
  assert.ok(out.polls >= 2, "retried after empty activeSubscriptions")
  assert.match(logs, /source=shopify/)
})

test("App Home forwards billing=ok and plan to the dashboard request", () => {
  const page = fs.readFileSync(path.join(root, "app/app/page.tsx"), "utf8")
  assert.match(page, /billing"\) === "ok"/)
  assert.match(page, /dashboardParams\.set\("plan"/)
})

/** Shopify's real app_subscriptions/update body: fields nested under `app_subscription`. */
function nestedSubscriptionPayload(fields: Record<string, unknown>) {
  return {
    app_subscription: {
      admin_graphql_api_shop_id: "gid://shopify/Shop/1",
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
      currency: "USD",
      ...fields,
    },
  }
}

function subscriptionWebhookScript(options: {
  payload: Record<string, unknown>
  currentSubscriptionId?: string | null
  billingStatus?: string
  billingPlan?: string | null
}) {
  return `
  const shop = "${SHOP}"
  putStore({
    id: "store-1",
    shopify_domain: shop,
    billing_status: ${JSON.stringify(options.billingStatus ?? "active")},
    billing_plan: ${JSON.stringify(options.billingPlan === undefined ? "starter" : options.billingPlan)},
    shopify_subscription_id: ${JSON.stringify(options.currentSubscriptionId ?? null)},
    shopify_access_token: "shpat_live",
  })
  const { POST } = await load("./app/api/webhooks/shopify/route.ts")
  const { NextRequest } = await import("next/server")
  const payload = ${JSON.stringify(JSON.stringify(options.payload))}
  const res = await POST(new NextRequest("http://localhost/api/webhooks/shopify", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-topic": "app_subscriptions/update",
      "x-shopify-shop-domain": shop,
      "x-shopify-hmac-sha256": "unused-when-verify-off",
    },
    body: payload,
  }))
  const row = storesByDomain.get(shop)
  console.log("RESULT:" + JSON.stringify({
    status: res.status,
    billing_status: row.billing_status,
    billing_plan: row.billing_plan,
    shopify_subscription_id: row.shopify_subscription_id,
  }))
`
}

test("CartRenew: CANCELLED subscription webhook with null shopify_subscription_id is applied (main behaviour)", () => {
  // CartRenew still reads the top-level fields; its payload handling is unchanged.
  const script = subscriptionWebhookScript({
    payload: {
      admin_graphql_api_id: "gid://shopify/AppSubscription/old",
      name: "Starter",
      status: "CANCELLED",
    },
  })
  const { out, logs } = runChild("CartRenew", script, { SHOPIFY_WEBHOOK_VERIFY: "false" })

  assert.equal(out.status, 200)
  assert.equal(out.billing_status, "cancelled", "CartRenew applies inactive update when current id is null")
  assert.equal(out.shopify_subscription_id, "gid://shopify/AppSubscription/old")
  assert.equal(logs.includes("ignored_stale"), false)
})

test("Pingza: CANCELLED subscription webhook with null shopify_subscription_id is ignored", () => {
  const script = subscriptionWebhookScript({
    payload: nestedSubscriptionPayload({
      admin_graphql_api_id: "gid://shopify/AppSubscription/old",
      name: "Pingza Starter",
      status: "CANCELLED",
    }),
  })
  const { out, logs } = runChild("Pingza", script, { SHOPIFY_WEBHOOK_VERIFY: "false" })

  assert.equal(out.status, 200)
  assert.equal(out.billing_status, "active", "Pingza keeps existing plan when current id is null")
  assert.equal(out.shopify_subscription_id, null)
  assert.match(logs, /ignored_stale/)
})

test("Pingza: nested CANCELLED webhook for the current subscription is applied", () => {
  const script = subscriptionWebhookScript({
    currentSubscriptionId: "gid://shopify/AppSubscription/cur",
    payload: nestedSubscriptionPayload({
      admin_graphql_api_id: "gid://shopify/AppSubscription/cur",
      name: "Pingza Starter",
      status: "CANCELLED",
    }),
  })
  const { out, logs } = runChild("Pingza", script, { SHOPIFY_WEBHOOK_VERIFY: "false" })

  assert.equal(out.status, 200)
  assert.equal(out.billing_status, "cancelled")
  assert.equal(out.shopify_subscription_id, "gid://shopify/AppSubscription/cur")
  assert.equal(logs.includes("ignored_stale"), false)
})

test("Pingza: nested ACTIVE webhook sets status, plan and subscription id", () => {
  const script = subscriptionWebhookScript({
    billingStatus: "pending",
    billingPlan: null,
    payload: nestedSubscriptionPayload({
      admin_graphql_api_id: "gid://shopify/AppSubscription/new",
      name: "Pingza Growth",
      status: "ACTIVE",
    }),
  })
  const { out } = runChild("Pingza", script, { SHOPIFY_WEBHOOK_VERIFY: "false" })

  assert.equal(out.status, 200)
  assert.equal(out.billing_status, "active")
  assert.equal(out.billing_plan, "growth")
  assert.equal(out.shopify_subscription_id, "gid://shopify/AppSubscription/new")
})
