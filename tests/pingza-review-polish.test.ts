import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SHOP = "pingza-review-test.myshopify.com"
const SECRET = "test-secret"

const CHILD = `
  const json = (value, status = 200) =>
    new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } })
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url ?? String(input)
    if (url.includes("/rest/v1/stores")) {
      const row = { id: "store-1", shopify_access_token: null }
      const accept = new Headers(init.headers).get("accept") || ""
      return accept.includes("vnd.pgrst.object") ? json(row) : json([row])
    }
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
        SHOPIFY_API_SECRET: SECRET,
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

const RENDER_LAYOUTS = `
  const React = (await import("react")).default
  const { renderToStaticMarkup } = await import("react-dom/server")
  const defaultExport = async (file) => {
    const mod = await import(file)
    return mod.default?.default ?? mod.default
  }
  const appLayout = await defaultExport("./app/app/layout.tsx")
  const shopifyLayout = await defaultExport("./app/shopify/layout.tsx")
  const render = (Layout) =>
    renderToStaticMarkup(React.createElement(Layout, null, React.createElement("main", null, "child")))
  console.log("RESULT:" + JSON.stringify({ app: render(appLayout), shopify: render(shopifyLayout) }))
`

test("Pingza: embedded layouts hide the System Status bar", () => {
  const { out } = runChild("Pingza", RENDER_LAYOUTS)
  for (const html of [out.app, out.shopify]) {
    assert.equal(html.includes("System Status"), false)
    assert.equal(html.includes("Supabase"), false)
    assert.match(html, /<main>child<\/main>/)
  }
})

test("Pingza: App Home legal links open in a new tab", () => {
  const { out } = runChild("Pingza", RENDER_LAYOUTS)
  const links = out.app.match(/<a [^>]*>(Privacy Policy|Terms of Service)<\/a>/g) ?? []
  assert.equal(links.length, 2)
  for (const link of links) {
    assert.match(link, /target="_blank"/)
    assert.match(link, /rel="noopener noreferrer"/)
  }
})

test("CartRenew: embedded layouts keep the System Status bar and no legal nav", () => {
  const { out } = runChild("CartRenew", RENDER_LAYOUTS)
  assert.match(out.app, /System Status/)
  assert.match(out.shopify, /System Status/)
  assert.equal(out.app.includes("Privacy Policy"), false)
})

const STATUS = `
  const { GET } = await load("./app/api/system/status/route.ts")
  const res = await GET()
  console.log("RESULT:" + JSON.stringify(await res.json()))
`

test("Pingza: /api/system/status omits the webhook bypass flag", () => {
  const { out } = runChild("Pingza", STATUS, { SHOPIFY_WEBHOOK_BYPASS: "true" })
  assert.equal("bypass" in out.shopifyWebhooks, false)
})

test("CartRenew: /api/system/status still reports the webhook bypass flag", () => {
  const { out } = runChild("CartRenew", STATUS, { SHOPIFY_WEBHOOK_BYPASS: "true" })
  assert.equal(out.shopifyWebhooks.bypass, true)
})

function webhookScript(options: { hmac: string; skipHeader?: boolean }) {
  const body = JSON.stringify({ id: 1 })
  return `
  const { POST } = await load("./app/api/webhooks/shopify/route.ts")
  const { NextRequest } = await import("next/server")
  const res = await POST(new NextRequest("http://localhost/api/webhooks/shopify", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-topic": "shop/update",
      "x-shopify-shop-domain": "${SHOP}",
      "x-shopify-hmac-sha256": ${JSON.stringify(options.hmac)},
      ${options.skipHeader ? '"x-shopify-webhook-skip-verify": "true",' : ""}
    },
    body: ${JSON.stringify(body)},
  }))
  console.log("RESULT:" + JSON.stringify({ status: res.status, body: await res.json() }))
`
}

function signedHmac() {
  return crypto.createHmac("sha256", SECRET).update(JSON.stringify({ id: 1 }), "utf8").digest("base64")
}

const PROD_BYPASS_ENV = {
  NODE_ENV: "production",
  SHOPIFY_WEBHOOK_VERIFY: "false",
  SHOPIFY_WEBHOOK_BYPASS: "true",
}

test("Pingza production: SHOPIFY_WEBHOOK_VERIFY=false does not skip HMAC", () => {
  const { out, logs } = runChild("Pingza", webhookScript({ hmac: "bad" }), PROD_BYPASS_ENV)
  assert.equal(out.status, 401)
  assert.equal(out.body.reason, "hmac_mismatch")
  assert.equal(logs.includes("verification skipped"), false)
})

test("Pingza production: skip-verify header does not skip HMAC", () => {
  const { out } = runChild(
    "Pingza",
    webhookScript({ hmac: "bad", skipHeader: true }),
    PROD_BYPASS_ENV
  )
  assert.equal(out.status, 401)
})

test("Pingza production: a correctly signed webhook is accepted", () => {
  const { out, logs } = runChild("Pingza", webhookScript({ hmac: signedHmac() }), PROD_BYPASS_ENV)
  assert.equal(out.status, 200)
  assert.match(logs, /HMAC verified/)
})

test("Pingza non-production: SHOPIFY_WEBHOOK_VERIFY=false still skips HMAC", () => {
  const { out } = runChild("Pingza", webhookScript({ hmac: "bad" }), {
    NODE_ENV: "development",
    SHOPIFY_WEBHOOK_VERIFY: "false",
  })
  assert.equal(out.status, 200)
})

test("CartRenew production: SHOPIFY_WEBHOOK_VERIFY=false behaviour is unchanged", () => {
  const { out, logs } = runChild("CartRenew", webhookScript({ hmac: "bad" }), PROD_BYPASS_ENV)
  assert.equal(out.status, 200)
  assert.match(logs, /verification skipped/)
})
