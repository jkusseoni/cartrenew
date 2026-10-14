import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  INVALID_TEST_PHONE_ERROR,
  sendShopifyTestMessage,
  TEST_MESSAGE_CUSTOMER_NAME,
  TEST_MESSAGE_DAILY_LIMIT,
  testMessageCheckoutUrl,
  utcDayStart,
  validateTestPhone,
  type SendTestTemplate,
  type TestMessageLog,
} from "../lib/shopify/test-message"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SHOP = "demo-store.myshopify.com"
const PHONE = "+447700900123"

type Row = {
  id: string
  storeId: string
  createdAt: string
  maskedPhone: string
  shop: string
  success?: boolean
  messageId?: string | null
  error?: string | null
}

function memoryLog(clock: { now: Date }) {
  const rows: Row[] = []
  let seq = 0
  const log: TestMessageLog = {
    async reserve({ storeId, shop, maskedPhone }) {
      seq += 1
      const id = `row-${String(seq).padStart(4, "0")}`
      rows.push({ id, storeId, shop, maskedPhone, createdAt: clock.now.toISOString() })
      return id
    },
    async earliestIdsSince(storeId, sinceIso, limit) {
      return rows
        .filter((row) => row.storeId === storeId && row.createdAt >= sinceIso)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
        .slice(0, limit)
        .map((row) => row.id)
    },
    async release(id) {
      const index = rows.findIndex((row) => row.id === id)
      if (index >= 0) rows.splice(index, 1)
    },
    async finish(id, outcome) {
      const row = rows.find((r) => r.id === id)
      if (row) Object.assign(row, outcome)
    },
  }
  return { log, rows }
}

function recordingSend(result: Awaited<ReturnType<SendTestTemplate>> = { success: true, messageId: "wamid.test" }) {
  const calls: Parameters<SendTestTemplate>[0][] = []
  const send: SendTestTemplate = async (input) => {
    calls.push(input)
    return result
  }
  return { send, calls }
}

test("validateTestPhone accepts E.164 and strips separators", () => {
  assert.deepEqual(validateTestPhone("+44 7700 900123"), { ok: true, e164: PHONE })
  assert.deepEqual(validateTestPhone(" +1 (415) 867-5309 "), { ok: true, e164: "+14158675309" })
})

test("validateTestPhone rejects numbers that are not E.164", () => {
  for (const raw of ["", "07700900123", "447700900123", "+0447700900123", "+12345", "+1234567890123456", "+1555 555 1212", "abc", null, 447700900123]) {
    assert.deepEqual(validateTestPhone(raw), { ok: false, error: INVALID_TEST_PHONE_ERROR }, String(raw))
  }
})

test("utcDayStart is midnight UTC", () => {
  assert.equal(utcDayStart(new Date("2026-10-13T23:59:59.999Z")).toISOString(), "2026-10-13T00:00:00.000Z")
})

test("test send uses the sample name and the shop cart link, not a cart", async () => {
  const clock = { now: new Date("2026-10-13T10:00:00Z") }
  const { log, rows } = memoryLog(clock)
  const { send, calls } = recordingSend()

  const outcome = await sendShopifyTestMessage({ storeId: "store-1", shop: SHOP, e164: PHONE, now: clock.now, log, send })

  assert.deepEqual(outcome, { status: "sent", remaining: TEST_MESSAGE_DAILY_LIMIT - 1 })
  assert.deepEqual(calls, [
    { phone: PHONE, customerName: TEST_MESSAGE_CUSTOMER_NAME, checkoutUrl: testMessageCheckoutUrl(SHOP) },
  ])
  assert.match(TEST_MESSAGE_CUSTOMER_NAME, /TEST/)
  assert.equal(testMessageCheckoutUrl(SHOP), `https://${SHOP}/cart?test_message=1`)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].success, true)
  assert.equal(rows[0].messageId, "wamid.test")
})

test("the log keeps only a masked phone, including in stored errors", async () => {
  const clock = { now: new Date("2026-10-13T10:00:00Z") }
  const { log, rows } = memoryLog(clock)
  const { send } = recordingSend({ success: false, error: `Recipient ${PHONE} not in allowed list` })

  const outcome = await sendShopifyTestMessage({ storeId: "store-1", shop: SHOP, e164: PHONE, now: clock.now, log, send })

  assert.deepEqual(outcome, { status: "send_failed", remaining: TEST_MESSAGE_DAILY_LIMIT - 1 })
  const stored = JSON.stringify(rows)
  assert.equal(stored.includes("7700900123"), false)
  assert.equal(rows[0].maskedPhone, "********0123")
  assert.match(rows[0].error ?? "", /\[redacted-phone\]/)
})

test("allows 3 test sends per shop per UTC day, failed sends included", async () => {
  const clock = { now: new Date("2026-10-13T08:00:00Z") }
  const { log, rows } = memoryLog(clock)
  const ok = recordingSend()
  const failing = recordingSend({ success: false, error: "boom" })

  const results = []
  results.push(await sendShopifyTestMessage({ storeId: "store-1", shop: SHOP, e164: PHONE, now: clock.now, log, send: ok.send }))
  results.push(await sendShopifyTestMessage({ storeId: "store-1", shop: SHOP, e164: PHONE, now: clock.now, log, send: failing.send }))
  results.push(await sendShopifyTestMessage({ storeId: "store-1", shop: SHOP, e164: PHONE, now: clock.now, log, send: ok.send }))
  results.push(await sendShopifyTestMessage({ storeId: "store-1", shop: SHOP, e164: PHONE, now: clock.now, log, send: ok.send }))

  assert.deepEqual(results.map((r) => r.status), ["sent", "send_failed", "sent", "rate_limited"])
  assert.deepEqual(results.slice(0, 3).map((r) => ("remaining" in r ? r.remaining : null)), [2, 1, 0])
  assert.equal(ok.calls.length + failing.calls.length, 3)
  assert.equal(rows.length, 3, "rejected attempt is removed from the log")

  const otherShop = await sendShopifyTestMessage({ storeId: "store-2", shop: "other.myshopify.com", e164: PHONE, now: clock.now, log, send: ok.send })
  assert.equal(otherShop.status, "sent", "limit is per shop")

  clock.now = new Date("2026-10-14T00:00:01Z")
  const nextDay = await sendShopifyTestMessage({ storeId: "store-1", shop: SHOP, e164: PHONE, now: clock.now, log, send: ok.send })
  assert.equal(nextDay.status, "sent", "limit resets at 00:00 UTC")
})

test("concurrent requests can't exceed the daily limit", async () => {
  const clock = { now: new Date("2026-10-13T08:00:00Z") }
  const { log, rows } = memoryLog(clock)
  const { send, calls } = recordingSend()

  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      sendShopifyTestMessage({ storeId: "store-1", shop: SHOP, e164: PHONE, now: clock.now, log, send })
    )
  )

  assert.equal(results.filter((r) => r.status === "sent").length, TEST_MESSAGE_DAILY_LIMIT)
  assert.equal(results.filter((r) => r.status === "rate_limited").length, 2)
  assert.equal(calls.length, TEST_MESSAGE_DAILY_LIMIT)
  assert.equal(rows.length, TEST_MESSAGE_DAILY_LIMIT)
})

test("does not send when the log is unavailable", async () => {
  const { send, calls } = recordingSend()
  const released: string[] = []

  const reserveFails: TestMessageLog = {
    reserve: async () => {
      throw new Error("relation does not exist")
    },
    earliestIdsSince: async () => [],
    release: async () => undefined,
    finish: async () => undefined,
  }
  const lookupFails: TestMessageLog = {
    reserve: async () => "row-1",
    earliestIdsSince: async () => {
      throw new Error("timeout")
    },
    release: async (id) => {
      released.push(id)
    },
    finish: async () => undefined,
  }

  assert.deepEqual(
    await sendShopifyTestMessage({ storeId: "s", shop: SHOP, e164: PHONE, log: reserveFails, send }),
    { status: "log_unavailable" }
  )
  assert.deepEqual(
    await sendShopifyTestMessage({ storeId: "s", shop: SHOP, e164: PHONE, log: lookupFails, send }),
    { status: "log_unavailable" }
  )
  assert.equal(calls.length, 0)
  assert.deepEqual(released, ["row-1"])
})

test("test-send code never touches carts, messages or analytics", () => {
  for (const file of [
    "app/api/shopify/test-message/route.ts",
    "lib/shopify/test-message.ts",
    "lib/shopify/test-message-log.ts",
  ]) {
    const src = fs.readFileSync(path.join(root, file), "utf8")
    assert.doesNotMatch(src, /from\(\s*['"](abandoned_carts|messages|analytics_daily)['"]/, file)
    assert.doesNotMatch(src, /rpc\(/, file)
  }
  const route = fs.readFileSync(path.join(root, "app/api/shopify/test-message/route.ts"), "utf8")
  assert.match(route, /send: sendRecoveryTemplate/)
})

const CHILD_PRELUDE = `
  import { NextRequest } from "next/server"
  import { SignJWT } from "jose"
  import { POST } from "./app/api/shopify/test-message/route.ts"

  const token = (shop) =>
    new SignJWT({ dest: "https://" + shop })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("test-client-id")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode("test-secret"))

  async function call(body, bearer) {
    const headers = { "content-type": "application/json" }
    if (bearer) headers.authorization = "Bearer " + bearer
    const res = await POST(new NextRequest("http://localhost/api/shopify/test-message", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }))
    return { status: res.status, body: await res.json() }
  }
`

function runChild(appName: string, script: string) {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", `${CHILD_PRELUDE}\n${script}`],
    {
      cwd: root,
      env: {
        ...process.env,
        NEXT_PUBLIC_APP_NAME: appName,
        SHOPIFY_API_KEY: "test-client-id",
        NEXT_PUBLIC_SHOPIFY_API_KEY: "",
        NEXT_PUBLIC_SHOPIFY_CLIENT_ID: "",
        NEXT_PUBLIC_SHOPIFY_APP_API_KEY: "",
        SHOPIFY_API_SECRET: "test-secret",
        SHOPIFY_CLIENT_SECRET: "",
        WHATSAPP_ACCESS_TOKEN: "",
        WHATSAPP_PHONE_NUMBER_ID: "",
      },
      encoding: "utf8",
    }
  )
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  const line = result.stdout.split(/\r?\n/).find((l) => l.startsWith("RESULT:"))
  assert.ok(line, result.stdout)
  return JSON.parse(line.slice("RESULT:".length))
}

test("CartRenew: test-message route is 404 even with a valid session", () => {
  const out = runChild(
    "CartRenew",
    `console.log("RESULT:" + JSON.stringify(await call({ phone: "${PHONE}" }, await token("${SHOP}"))))`
  )
  assert.deepEqual(out, { status: 404, body: { error: "Not found" } })
})

test("Pingza: route checks session, shop and number before sending", () => {
  const out = runChild(
    "Pingza",
    `
      const t = await token("${SHOP}")
      console.log("RESULT:" + JSON.stringify({
        noToken: await call({ phone: "${PHONE}" }),
        badToken: await call({ phone: "${PHONE}" }, "not-a-session"),
        otherShop: await call({ phone: "${PHONE}", shop: "other.myshopify.com" }, t),
        badPhone: await call({ phone: "07700900123" }, t),
        noWhatsApp: await call({ phone: "${PHONE}", shop: "${SHOP}" }, t),
      }))
    `
  )
  assert.deepEqual(out.noToken, { status: 401, body: { error: "Unauthorized" } })
  assert.deepEqual(out.badToken, { status: 401, body: { error: "Unauthorized" } })
  assert.deepEqual(out.otherShop, { status: 403, body: { error: "Forbidden" } })
  assert.deepEqual(out.badPhone, { status: 400, body: { error: INVALID_TEST_PHONE_ERROR } })
  assert.equal(out.noWhatsApp.status, 503)
  assert.equal(JSON.stringify(out.noWhatsApp.body).includes("WHATSAPP_"), false)
})

test("test message card renders the form and the daily limit", async () => {
  const { default: Card } = await import("../components/shopify/ShopifyTestMessageCard.tsx")
  const html = renderToStaticMarkup(React.createElement(Card, { shop: SHOP, dailyLimit: 3 }))
  assert.match(html, /Send test message/)
  assert.match(html, /Up to 3 per day/)
  assert.match(html, /type="tel"/)
  assert.match(html, /disabled=""/, "button is disabled until a number is entered")
})

// The embedded App Home loads its dashboard in an effect, which a server
// render never runs. Seed the page's first useState calls (data, status
// message, loading, setup error, load nonce) with a loaded dashboard so the
// console itself renders. Child components keep the real useState.
function renderAppHome(appName: string): string {
  const dashboard = {
    shop: SHOP,
    store: { id: "store-1", shopify_domain: SHOP, billing_plan: null, billing_status: "NONE" },
    metrics: { trackedCarts: 0, recovered: 0, recoveredValue: 0 },
    carts: [],
  }
  const script = `
    import { createRequire } from "node:module"
    const require = createRequire(process.cwd() + "/")
    const React = require("react")
    const realUseState = React.useState
    const seeded = [${JSON.stringify(dashboard)}, "", false, false, 0]
    let calls = 0
    React.useState = (initial) =>
      calls < seeded.length ? [seeded[calls++], () => {}] : realUseState(initial)
    const { renderToStaticMarkup } = await import("react-dom/server")
    const mod = await import("./app/app/page.tsx")
    const Page = mod.default?.default ?? mod.default
    console.log("RESULT:" + JSON.stringify(renderToStaticMarkup(React.createElement(Page))))
  `
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", script],
    { cwd: root, env: { ...process.env, NEXT_PUBLIC_APP_NAME: appName }, encoding: "utf8" }
  )
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  const line = result.stdout.split(/\r?\n/).find((l) => l.startsWith("RESULT:"))
  assert.ok(line, result.stdout)
  return JSON.parse(line.slice("RESULT:".length)) as string
}

test("embedded App Home (app/app/page.tsx) shows the card for Pingza", () => {
  const html = renderAppHome("Pingza")
  assert.match(html, /Shopify Billing/, "console rendered")
  assert.match(html, /Send test message/)
  assert.match(html, /Up to 3 per day/)
})

test("embedded App Home (app/app/page.tsx) has no card for CartRenew", () => {
  const html = renderAppHome("CartRenew")
  assert.match(html, /Shopify Billing/, "console rendered")
  assert.equal(html.includes("Send test message"), false)
})

test("legacy /shopify dashboard renders the card only for non-default brands", () => {
  const page = fs.readFileSync(path.join(root, "app/shopify/page.tsx"), "utf8")
  assert.match(page, /\{!brand\.isDefault \? \(\s*<ShopifyTestMessageCard/)
})
