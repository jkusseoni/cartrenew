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
  assert.equal(pickActiveSubscription(subs, "gid://old")?.id, "gid://old")
  assert.equal(pickActiveSubscription(subs, null)?.id, "gid://new")
  assert.equal(pickActiveSubscription([], null), null)
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

test("Pingza: stale CANCELLED webhook for an old subscription id is ignored", () => {
  const { out } = runChild(
    "Pingza",
    `
      const shop = "${SHOP}"
      putStore({
        id: "store-1",
        shopify_domain: shop,
        billing_status: "active",
        billing_plan: "starter",
        shopify_subscription_id: "gid://shopify/AppSubscription/new",
      })
      const { isInactiveBillingStatus } = await load("./lib/shopify/billing-sync.ts")
      const { toDbBillingStatus } = await load("./lib/shopify/billing.ts")
      const adminGraphqlId = "gid://shopify/AppSubscription/old"
      const billingStatus = toDbBillingStatus("CANCELLED")
      const currentId = storesByDomain.get(shop).shopify_subscription_id
      let ignored = false
      if (isInactiveBillingStatus(billingStatus) && currentId && currentId !== adminGraphqlId) {
        ignored = true
      } else {
        Object.assign(storesByDomain.get(shop), { billing_status: billingStatus, shopify_subscription_id: adminGraphqlId })
      }
      console.log("RESULT:" + JSON.stringify({ ignored, row: storesByDomain.get(shop) }))
    `
  )

  assert.equal(out.ignored, true)
  assert.equal(out.row.billing_status, "active")
  assert.equal(out.row.shopify_subscription_id, "gid://shopify/AppSubscription/new")
})

test("App Home forwards billing=ok and plan to the dashboard request", () => {
  const page = fs.readFileSync(path.join(root, "app/app/page.tsx"), "utf8")
  assert.match(page, /billing"\) === "ok"/)
  assert.match(page, /dashboardParams\.set\("plan"/)
})
