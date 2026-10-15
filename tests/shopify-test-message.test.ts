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
  TEST_MESSAGE_OPTED_OUT_CODE,
  TEST_MESSAGE_OPTED_OUT_TEXT,
  TEST_MESSAGE_PENDING_TEXT,
  TEST_MESSAGE_SEND_TIMEOUT_MS,
  testMessageCheckoutUrl,
  testMessageHttpResult,
  utcDayStart,
  validateTestPhone,
  type SendTestTemplate,
  type TestMessageLog,
} from "../lib/shopify/test-message"
import { WHATSAPP_OPT_OUT_CHECK_FAILED, WHATSAPP_OPTED_OUT_ERROR } from "../lib/whatsapp/opt-out"

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

function captureLogs(t: import("node:test").TestContext) {
  const lines: string[] = []
  for (const level of ["info", "warn", "error"] as const) {
    t.mock.method(console, level, (...args: unknown[]) => {
      lines.push(JSON.stringify(args))
    })
  }
  return lines
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

test("Meta send waits 20s by default", () => {
  assert.equal(TEST_MESSAGE_SEND_TIMEOUT_MS, 20_000)
})

test("send logs carry duration_ms and no phone number", async (t) => {
  const lines = captureLogs(t)
  const clock = { now: new Date("2026-10-13T10:00:00Z") }
  const { log } = memoryLog(clock)

  await sendShopifyTestMessage({ storeId: "s", shop: SHOP, e164: PHONE, now: clock.now, log, send: recordingSend().send })
  await sendShopifyTestMessage({
    storeId: "s",
    shop: SHOP,
    e164: PHONE,
    now: clock.now,
    log,
    send: recordingSend({ success: false, error: `bad ${PHONE}` }).send,
  })

  const sent = lines.find((l) => l.includes("] sent"))
  const failed = lines.find((l) => l.includes("send failed"))
  assert.match(sent ?? "", /"duration_ms":\d+/)
  assert.match(failed ?? "", /"duration_ms":\d+/)
  for (const line of lines) {
    assert.equal(line.includes("0123"), false, `phone digits in log: ${line}`)
  }
})

test("a send slower than the timeout is 'pending' and still completes", async (t) => {
  const lines = captureLogs(t)
  const clock = { now: new Date("2026-10-13T10:00:00Z") }
  const { log, rows } = memoryLog(clock)
  const meta = deferred<Awaited<ReturnType<SendTestTemplate>>>()
  let sends = 0

  const outcome = await sendShopifyTestMessage({
    storeId: "s",
    shop: SHOP,
    e164: PHONE,
    now: clock.now,
    log,
    sendTimeoutMs: 20,
    send: () => {
      sends += 1
      return meta.promise
    },
  })

  assert.equal(outcome.status, "pending")
  assert.equal("remaining" in outcome && outcome.remaining, TEST_MESSAGE_DAILY_LIMIT - 1)
  assert.equal(sends, 1, "the send is not cancelled or retried")
  assert.equal(rows[0].success, undefined, "log row still in progress")
  assert.match(lines.find((l) => l.includes("after timeout")) ?? "", /"duration_ms":\d+/)

  meta.resolve({ success: true, messageId: "wamid.late" })
  if (outcome.status === "pending") await outcome.completion
  assert.equal(rows[0].success, true)
  assert.equal(rows[0].messageId, "wamid.late")
  assert.ok(lines.some((l) => l.includes("] sent") && /"duration_ms":\d+/.test(l)))
  assert.equal(lines.some((l) => l.includes("0123")), false)
})

test("a fast send isn't reported as pending", async () => {
  const clock = { now: new Date("2026-10-13T10:00:00Z") }
  const { log } = memoryLog(clock)
  const outcome = await sendShopifyTestMessage({
    storeId: "s",
    shop: SHOP,
    e164: PHONE,
    now: clock.now,
    log,
    sendTimeoutMs: 1_000,
    send: recordingSend().send,
  })
  assert.deepEqual(outcome, { status: "sent", remaining: TEST_MESSAGE_DAILY_LIMIT - 1 })
})

test("HTTP mapping: timeout is 202 with the being-sent text", () => {
  const pending = testMessageHttpResult({ status: "pending", remaining: 1, completion: Promise.resolve() })
  assert.equal(pending.status, 202)
  assert.deepEqual(pending.body, { ok: true, pending: true, message: TEST_MESSAGE_PENDING_TEXT, remaining: 1 })
  assert.equal(TEST_MESSAGE_PENDING_TEXT, "Your test message is being sent. It can take a minute to arrive.")

  assert.deepEqual(testMessageHttpResult({ status: "sent", remaining: 2 }), { status: 200, body: { ok: true, remaining: 2 } })
  assert.equal(testMessageHttpResult({ status: "send_failed", remaining: 0 }).status, 502)
  assert.equal(testMessageHttpResult({ status: "rate_limited" }).status, 429)
  assert.equal(testMessageHttpResult({ status: "log_unavailable" }).status, 503)
})

test("an opted-out number is its own outcome; other failures stay generic", async () => {
  const clock = { now: new Date("2026-10-13T10:00:00Z") }
  const { log, rows } = memoryLog(clock)
  const run = (error: string) =>
    sendShopifyTestMessage({
      storeId: "s",
      shop: SHOP,
      e164: PHONE,
      now: clock.now,
      log,
      send: recordingSend({ success: false, error, to: null }).send,
    })

  assert.deepEqual(await run(WHATSAPP_OPTED_OUT_ERROR), { status: "opted_out", remaining: 2 })
  assert.equal(rows[0].error, WHATSAPP_OPTED_OUT_ERROR, "attempt is logged and counts toward the limit")
  assert.deepEqual(await run(WHATSAPP_OPT_OUT_CHECK_FAILED), { status: "send_failed", remaining: 1 })
  assert.deepEqual(await run(`Meta error: ${WHATSAPP_OPTED_OUT_ERROR}`), { status: "send_failed", remaining: 0 })
})

test("HTTP mapping: opted-out is a 409 with the STOP text and nothing else", () => {
  assert.equal(TEST_MESSAGE_OPTED_OUT_CODE, WHATSAPP_OPTED_OUT_ERROR)
  assert.equal(
    TEST_MESSAGE_OPTED_OUT_TEXT,
    "This number has opted out of messages (it replied STOP). Use a different number for testing."
  )
  assert.deepEqual(testMessageHttpResult({ status: "opted_out", remaining: 1 }), {
    status: 409,
    body: { error: TEST_MESSAGE_OPTED_OUT_TEXT, code: TEST_MESSAGE_OPTED_OUT_CODE, remaining: 1 },
  })
  const failed = testMessageHttpResult({ status: "send_failed", remaining: 1 })
  assert.equal("code" in failed.body, false)
  assert.notEqual(failed.body.error, TEST_MESSAGE_OPTED_OUT_TEXT)
})

test("card shows the opted-out text for the opted-out code and generic errors otherwise", async () => {
  const { testMessageResult, TestMessageResultView } = await import(
    "../components/shopify/ShopifyTestMessageCard.tsx"
  )

  const optedOut = testMessageResult(409, { code: TEST_MESSAGE_OPTED_OUT_CODE, error: "ignored", remaining: 1 }, PHONE)
  assert.deepEqual(optedOut, { kind: "error", message: TEST_MESSAGE_OPTED_OUT_TEXT, warning: true })
  const html = renderToStaticMarkup(React.createElement(TestMessageResultView, { result: optedOut }))
  assert.match(html, /role="alert"/)
  assert.ok(html.includes("This number has opted out of messages (it replied STOP). Use a different number for testing."))
  assert.match(html, /amber/)

  const metaError = "WhatsApp didn't accept the test message. Check that the number is on WhatsApp and try again."
  assert.deepEqual(testMessageResult(502, { error: metaError, remaining: 1 }, PHONE), {
    kind: "error",
    message: metaError,
    warning: false,
  })
  assert.deepEqual(testMessageResult(500, {}, PHONE), {
    kind: "error",
    message: "The test message couldn't be sent. Try again.",
    warning: false,
  })
  assert.equal(testMessageResult(429, { error: "limit" }, PHONE).kind === "error", true)
  assert.deepEqual(testMessageResult(200, { ok: true, remaining: 2 }, PHONE), {
    kind: "sent",
    phone: PHONE,
    remaining: 2,
    pendingMessage: null,
  })
})

test("route keeps a pending send alive and the card waits 30s", () => {
  const route = fs.readFileSync(path.join(root, "app/api/shopify/test-message/route.ts"), "utf8")
  assert.match(route, /after\(\(\) => outcome\.completion\)/)
  assert.match(route, /export const maxDuration = 60/)

  const card = fs.readFileSync(path.join(root, "components/shopify/ShopifyTestMessageCard.tsx"), "utf8")
  assert.match(card, /TEST_MESSAGE_REQUEST_TIMEOUT_MS = 30_000/)
  assert.match(card, /timeoutMs: TEST_MESSAGE_REQUEST_TIMEOUT_MS/)
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

test("Pingza route: an opted-out number gets the STOP message and nothing is sent; other numbers send", () => {
  const OTHER = "+14158675309"
  const script = `
    import { SignJWT } from "jose"
    const requests = []
    const metrics = []
    const json = (value, status = 200) =>
      new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } })
    globalThis.fetch = async (input, init = {}) => {
      const url = typeof input === "string" ? input : input.url ?? String(input)
      const method = (init.method || "GET").toUpperCase()
      const accept = new Headers(init.headers).get("accept") || ""
      requests.push({ url, method })
      const one = (row) => (accept.includes("vnd.pgrst.object") ? json(row) : json([row]))
      if (url.includes("graph.facebook.com")) return json({ messages: [{ id: "wamid.test" }], contacts: [{}] })
      if (url.includes("/rest/v1/stores")) return one({ id: "store-1" })
      if (url.includes("/rest/v1/email_suppressions")) {
        const key = (new URL(url).searchParams.get("email") || "").replace(/^eq\\./, "")
        return json(key === globalThis.__optedOutKey ? [{ id: "sup-1" }] : [])
      }
      if (url.includes("/rest/v1/cart_delivery_metrics")) {
        if (method === "POST") {
          const id = "row-" + (metrics.length + 1)
          metrics.push(id)
          return one({ id })
        }
        if (method === "GET") return json(metrics.map((id) => ({ id })))
        return json([])
      }
      return json([])
    }
    const load = async (file) => {
      const mod = await import(file)
      return { ...(mod.default ?? {}), ...mod }
    }
    const { whatsappSuppressionKey } = await load("./lib/whatsapp/opt-out.ts")
    globalThis.__optedOutKey = whatsappSuppressionKey("${PHONE}", "test-hash-secret")
    const { POST } = await load("./app/api/shopify/test-message/route.ts")
    const { NextRequest } = await import("next/server")
    const token = await new SignJWT({ dest: "https://${SHOP}" })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("test-client-id")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode("test-secret"))
    async function call(phone) {
      requests.splice(0)
      const res = await POST(new NextRequest("http://localhost/api/shopify/test-message", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + token },
        body: JSON.stringify({ phone, shop: "${SHOP}" }),
      }))
      const sent = requests.filter((r) => r.url.includes("graph.facebook.com")).length
      return { status: res.status, body: await res.json(), metaSends: sent }
    }
    const optedOut = await call("${PHONE}")
    const other = await call("${OTHER}")
    console.log("RESULT:" + JSON.stringify({ optedOut, other }))
  `
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
    cwd: root,
    env: {
      ...process.env,
      NEXT_PUBLIC_APP_NAME: "Pingza",
      SHOPIFY_API_KEY: "test-client-id",
      NEXT_PUBLIC_SHOPIFY_API_KEY: "",
      NEXT_PUBLIC_SHOPIFY_CLIENT_ID: "",
      NEXT_PUBLIC_SHOPIFY_APP_API_KEY: "",
      SHOPIFY_API_SECRET: "test-secret",
      SHOPIFY_CLIENT_SECRET: "",
      NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
      SUPPRESSION_HASH_SECRET: "test-hash-secret",
      WHATSAPP_ACCESS_TOKEN: "test-access-token",
      WHATSAPP_PHONE_NUMBER_ID: "1234567890",
    },
    encoding: "utf8",
  })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  const line = result.stdout.split(/\r?\n/).find((l) => l.startsWith("RESULT:"))
  assert.ok(line, `${result.stdout}\n${result.stderr}`)
  const out = JSON.parse(line.slice("RESULT:".length))

  assert.deepEqual(out.optedOut, {
    status: 409,
    body: { error: TEST_MESSAGE_OPTED_OUT_TEXT, code: TEST_MESSAGE_OPTED_OUT_CODE, remaining: 2 },
    metaSends: 0,
  })
  assert.equal(JSON.stringify(out.optedOut.body).includes("7700900123"), false, "number is not echoed")

  assert.equal(out.other.status, 200)
  assert.deepEqual(out.other.body, { ok: true, remaining: 1 }, "no opt-out info about other numbers")
  assert.equal(out.other.metaSends, 1)

  const logs = result.stdout
    .split(/\r?\n/)
    .filter((l) => !l.startsWith("RESULT:"))
    .join("\n") + result.stderr
  assert.equal(/7700900123|8675309/.test(logs), false, "no clear-text phone in logs")
})

test("legacy /shopify dashboard renders the card only for non-default brands", () => {
  const page = fs.readFileSync(path.join(root, "app/shopify/page.tsx"), "utf8")
  assert.match(page, /\{!brand\.isDefault \? \(\s*<ShopifyTestMessageCard/)
})
