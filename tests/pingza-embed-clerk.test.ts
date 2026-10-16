import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  isPingzaShopifyPath,
  isSetupPendingDashboard,
  isShopifyEntryPath,
  isShopifySessionApiPath,
} from "../lib/shopify/embed-routes"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

test("Shopify entry and session-token API path helpers", () => {
  assert.equal(isShopifyEntryPath("/app"), true)
  assert.equal(isShopifyEntryPath("/app/foo"), true)
  assert.equal(isShopifyEntryPath("/shopify"), true)
  assert.equal(isShopifyEntryPath("/shopify/x"), true)
  assert.equal(isShopifyEntryPath("/en/dashboard"), false)

  assert.equal(isShopifySessionApiPath("/api/app/dashboard"), true)
  assert.equal(isShopifySessionApiPath("/api/shopify/test-message"), true)
  assert.equal(isShopifySessionApiPath("/api/shopify/billing/callback"), true)
  assert.equal(isShopifySessionApiPath("/api/whatsapp/webhook"), false)
})

test("Pingza Shopify paths skip Clerk; CartRenew never matches", () => {
  for (const pathName of [
    "/app",
    "/app/billing",
    "/shopify",
    "/api/app/dashboard",
    "/api/shopify/test-message",
    "/api/shopify/webhook",
    "/api/auth/token-exchange",
  ]) {
    assert.equal(isPingzaShopifyPath(pathName, false), true, pathName)
    assert.equal(isPingzaShopifyPath(pathName, true), false, `CartRenew: ${pathName}`)
  }
  assert.equal(isPingzaShopifyPath("/en/dashboard", false), false)
  assert.equal(isPingzaShopifyPath("/api/analytics", false), false)
})

test("setup-pending is false once token-exchange returned a real store id", () => {
  assert.equal(isSetupPendingDashboard({ degraded: true, store: { id: "pending" } }), true)
  assert.equal(isSetupPendingDashboard({ store: null }), true)
  assert.equal(isSetupPendingDashboard({ store: { id: "pending" } }), true)
  assert.equal(
    isSetupPendingDashboard({ degraded: false, store: { id: "store-uuid-1" } }),
    false
  )
  assert.equal(
    isSetupPendingDashboard({ degraded: true, store: { id: "store-uuid-1" } }),
    true,
    "explicit degraded still pending"
  )
})

test("proxy.ts: Pingza bypasses clerkMiddleware for embed paths; CartRenew still uses it", () => {
  const src = fs.readFileSync(path.join(root, "proxy.ts"), "utf8")
  assert.match(src, /isPingzaShopifyPath/)
  assert.match(src, /handleWithoutClerk/)
  assert.match(src, /clerkProxy\(request,\s*event\)/)
  assert.match(src, /\/api\/shopify\(\.\*\)/)
  // CartRenew path still goes through clerkMiddleware unless skipClerk.
  assert.match(src, /const clerkProxy = clerkMiddleware/)
  assert.doesNotMatch(
    src,
    /if\s*\(\s*brand\.isDefault[\s\S]*?clerkMiddleware/,
    "CartRenew is not wrapped in a brand.isDefault-only clerk disable"
  )
})

test("providers skip Clerk on embed routes and export the helper", async () => {
  const { shouldSkipClerkProvider } = await import("../app/providers.tsx")
  assert.equal(shouldSkipClerkProvider("/app"), true)
  assert.equal(shouldSkipClerkProvider("/shopify"), true)
  assert.equal(shouldSkipClerkProvider("/en/dashboard"), false)
})

test("emptyDashboard after a real store id is not setup-pending (Pingza install race)", () => {
  // Mirrors emptyDashboard() in app/app/page.tsx
  const emptyDashboard = (shop: string, storeId?: string | null) => {
    const id = storeId || "pending"
    const confirmed = Boolean(storeId && storeId !== "pending")
    return {
      shop,
      store: { id, shopify_domain: shop },
      degraded: !confirmed,
    }
  }

  assert.equal(isSetupPendingDashboard(emptyDashboard("a.myshopify.com")), true)
  assert.equal(isSetupPendingDashboard(emptyDashboard("a.myshopify.com", "pending")), true)
  assert.equal(isSetupPendingDashboard(emptyDashboard("a.myshopify.com", "uuid-store")), false)
})

test("Pingza App Home auto-retries Finishing setup; CartRenew page has the brand gate", () => {
  const page = fs.readFileSync(path.join(root, "app/app/page.tsx"), "utf8")
  assert.match(page, /MAX_SETUP_AUTO_RETRIES/)
  assert.match(page, /if \(brand\.isDefault \|\| loading \|\| setupError \|\| !setupPending\) return/)
  assert.match(page, /degraded: !confirmed/)
})

test("Pingza child: isPingzaShopifyPath is true under NEXT_PUBLIC_APP_NAME=Pingza", () => {
  const script = `
    const { isPingzaShopifyPath } = await import("./lib/shopify/embed-routes.ts")
    const { brand } = await import("./lib/brand.ts")
    console.log("RESULT:" + JSON.stringify({
      isDefault: brand.isDefault,
      app: isPingzaShopifyPath("/app", brand.isDefault),
      api: isPingzaShopifyPath("/api/shopify/test-message", brand.isDefault),
      other: isPingzaShopifyPath("/en/dashboard", brand.isDefault),
    }))
  `
  const run = (appName: string) => {
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
      cwd: root,
      env: { ...process.env, NEXT_PUBLIC_APP_NAME: appName },
      encoding: "utf8",
    })
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const line = result.stdout.split(/\r?\n/).find((l) => l.startsWith("RESULT:"))
    assert.ok(line, result.stdout)
    return JSON.parse(line.slice("RESULT:".length))
  }

  const pingza = run("Pingza")
  assert.deepEqual(pingza, { isDefault: false, app: true, api: true, other: false })

  const cart = run("CartRenew")
  assert.deepEqual(cart, { isDefault: true, app: false, api: false, other: false })
})
