import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { decideAfterAttempt, isPermanentSendError } from "../lib/recovery-retry-policy"
import { suppressionHmac } from "../lib/privacy/suppression-hash"
import {
  extractOptOutSenders,
  isOptOutReply,
  WHATSAPP_OPT_OUT_CHECK_FAILED,
  WHATSAPP_OPTED_OUT_ERROR,
  whatsappOptOutGate,
  whatsappSuppressionKey,
} from "../lib/whatsapp/opt-out"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SECRET = "test-hash-secret"

test("opt-out keywords match the whole reply, trimmed and case-insensitive", () => {
  for (const text of [
    "STOP",
    " stop ",
    "Stop!",
    "UNSUBSCRIBE",
    "cancel.",
    "Opt Out",
    "opt-out",
    "OPTOUT",
    "रोको",
    " रोको। ",
  ]) {
    assert.equal(isOptOutReply(text), true, text)
  }
  for (const text of [
    "",
    "stop sending me this",
    "cancel my order",
    "don't stop",
    "hello",
    "stopp",
    "रोको मत",
    null,
    42,
  ]) {
    assert.equal(isOptOutReply(text), false, String(text))
  }
})

function inbound(messages: unknown[]) {
  return {
    object: "whatsapp_business_account",
    entry: [{ changes: [{ field: "messages", value: { messages } }] }],
  }
}

test("extractOptOutSenders reads text, button and interactive replies", () => {
  const body = inbound([
    { from: "447700900123", type: "text", text: { body: "STOP" } },
    { from: "447700900123", type: "text", text: { body: "stop" } },
    { from: "919876543210", type: "button", button: { text: "Unsubscribe", payload: "x" } },
    { from: "14158675309", type: "interactive", interactive: { button_reply: { title: "Opt out" } } },
    { from: "15551230000", type: "text", text: { body: "where is my order?" } },
    { from: "15551230001", type: "image", image: { id: "1" } },
    { type: "text", text: { body: "STOP" } },
  ])
  assert.deepEqual(extractOptOutSenders(body), ["+447700900123", "+919876543210", "+14158675309"])
  assert.deepEqual(extractOptOutSenders({ entry: [{ changes: [{ value: { statuses: [{ id: "w", status: "read" }] } }] }] }), [])
  assert.deepEqual(extractOptOutSenders(null), [])
})

test("suppression key is an HMAC of the E.164 number, never the number", () => {
  const key = whatsappSuppressionKey("+447700900123", SECRET)
  assert.match(key ?? "", /^hmac1:[0-9a-f]{64}$/)
  assert.equal(whatsappSuppressionKey("447700900123", SECRET), key, "Meta's wa_id form matches")
  assert.equal(whatsappSuppressionKey("+44 7700 900123", SECRET), key, "formatted input matches")
  assert.notEqual(key, suppressionHmac("+447700900123", SECRET), "namespaced apart from email keys")
  assert.notEqual(whatsappSuppressionKey("+447700900124", SECRET), key)
  assert.equal(whatsappSuppressionKey("+447700900123", ""), null)
  assert.equal(whatsappSuppressionKey("not a phone", SECRET), null)
})

test("gate: CartRenew never looks up; Pingza blocks opted-out numbers", async () => {
  const lookups: string[] = []
  const lookup = async (key: string) => {
    lookups.push(key)
    return key === whatsappSuppressionKey("+447700900123", SECRET)
  }

  assert.equal(await whatsappOptOutGate({ isDefaultBrand: true, phone: "+447700900123", secret: SECRET, lookup }), "clear")
  assert.equal(lookups.length, 0)

  assert.equal(await whatsappOptOutGate({ isDefaultBrand: false, phone: "447700900123", secret: SECRET, lookup }), "opted_out")
  assert.equal(await whatsappOptOutGate({ isDefaultBrand: false, phone: "+14158675309", secret: SECRET, lookup }), "clear")
  assert.equal(lookups.length, 2)

  assert.equal(await whatsappOptOutGate({ isDefaultBrand: false, phone: "+447700900123", secret: "", lookup }), "clear")
  assert.equal(lookups.length, 2, "no secret means nothing could have been recorded")

  const failing = async () => {
    throw new Error("db down")
  }
  assert.equal(await whatsappOptOutGate({ isDefaultBrand: false, phone: "+447700900123", secret: SECRET, lookup: failing }), "error")
})

test("opted-out is a permanent send error; a failed lookup is retried", () => {
  assert.equal(isPermanentSendError(WHATSAPP_OPTED_OUT_ERROR), true)
  assert.deepEqual(decideAfterAttempt(false, WHATSAPP_OPTED_OUT_ERROR, 1), { kind: "failed", reason: WHATSAPP_OPTED_OUT_ERROR })
  assert.equal(isPermanentSendError(WHATSAPP_OPT_OUT_CHECK_FAILED), false)
  assert.equal(decideAfterAttempt(false, WHATSAPP_OPT_OUT_CHECK_FAILED, 1).kind, "retry")
})

// Child processes freeze the brand at import. fetch is stubbed before any app
// module loads: Supabase REST keeps suppression rows in memory, Graph API
// always accepts.
const FETCH_STUB = `
  const requests = []
  const suppressed = new Set()
  const json = (value, status = 200) =>
    new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } })
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url ?? String(input)
    const method = (init.method || "GET").toUpperCase()
    const body = typeof init.body === "string" ? init.body : null
    requests.push({ url, method, body })
    if (url.includes("graph.facebook.com")) {
      return json({ messages: [{ id: "wamid.test" }], contacts: [{}] })
    }
    if (url.includes("/rest/v1/email_suppressions")) {
      if (method === "POST") {
        const rows = [].concat(JSON.parse(body))
        for (const row of rows) suppressed.add(row.email)
        return json([], 201)
      }
      const filter = new URL(url).searchParams.get("email") || ""
      const key = filter.startsWith("eq.") ? filter.slice(3) : ""
      return json(suppressed.has(key) ? [{ id: "row-1" }] : [])
    }
    return json([])
  }
  // tsx may load a file as CommonJS, exposing its exports under default.
  const load = async (file) => {
    const mod = await import(file)
    return { ...(mod.default ?? {}), ...mod }
  }
  const take = () => requests.splice(0)
`

const WEBHOOK_HELPERS = `
  const crypto = await import("node:crypto")
  const { NextRequest } = await import("next/server")
  const { POST } = await load("./app/api/whatsapp/webhook/route.ts")
  async function webhook(messages) {
    const raw = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages", value: { messages } }] }],
    })
    const sig = "sha256=" + crypto.createHmac("sha256", "test-app-secret").update(raw).digest("hex")
    const res = await POST(new NextRequest("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      headers: { "x-hub-signature-256": sig, "content-type": "application/json" },
      body: raw,
    }))
    return { status: res.status, body: await res.json() }
  }
`

function runChild(appName: string, script: string, env: Record<string, string> = {}) {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", `${FETCH_STUB}\n${script}`],
    {
      cwd: root,
      env: {
        ...process.env,
        NEXT_PUBLIC_APP_NAME: appName,
        NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
        SUPPRESSION_HASH_SECRET: SECRET,
        WHATSAPP_ACCESS_TOKEN: "test-access-token",
        WHATSAPP_PHONE_NUMBER_ID: "1234567890",
        WHATSAPP_APP_SECRET: "test-app-secret",
        ...env,
      },
      encoding: "utf8",
    }
  )
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  const line = result.stdout.split(/\r?\n/).find((l) => l.startsWith("RESULT:"))
  assert.ok(line, `${result.stdout}\n${result.stderr}`)
  return JSON.parse(line.slice("RESULT:".length))
}

type Req = { url: string; method: string; body: string | null }

const SCENARIO = `
  ${WEBHOOK_HELPERS}
  const { sendWhatsAppMessage } = await load("./lib/services/whatsapp-meta.ts")
  const template = { templateName: "abandoned_cart_reminder", languageCode: "en", bodyVariables: ["Asha", "https://shop.test/cart"] }

  const before = await sendWhatsAppMessage("+447700900123", template)
  const beforeRequests = take()

  const hook = await webhook([
    { from: "447700900123", type: "text", text: { body: "  Stop " } },
    { from: "919876543210", type: "text", text: { body: "रोको" } },
    { from: "14158675309", type: "text", text: { body: "stop sending me the cart link" } },
  ])
  const hookRequests = take()

  const after = await sendWhatsAppMessage("+44 7700 900123", template)
  const afterRequests = take()
  const other = await sendWhatsAppMessage("+14158675309", template)
  const otherRequests = take()

  console.log("RESULT:" + JSON.stringify({ before, beforeRequests, hook, hookRequests, after, afterRequests, other, otherRequests }))
`

const graphCalls = (requests: Req[]) => requests.filter((r) => r.url.includes("graph.facebook.com"))
const dbCalls = (requests: Req[]) => requests.filter((r) => r.url.includes("supabase.test"))

test("Pingza: STOP reply is suppressed (hashed, no reply) and later sends are blocked", () => {
  const out = runChild("Pingza", SCENARIO)

  assert.equal(out.before.success, true)
  assert.equal(graphCalls(out.beforeRequests).length, 1)
  assert.equal(dbCalls(out.beforeRequests).length, 1, "send checked the suppression list first")

  assert.equal(out.hook.status, 200)
  assert.equal(out.hook.body.opt_outs, 2)
  const writes = (out.hookRequests as Req[]).filter((r) => r.method === "POST" && r.url.includes("email_suppressions"))
  assert.equal(writes.length, 2)
  for (const write of writes) {
    const row = JSON.parse(write.body ?? "{}")
    assert.match(row.email, /^hmac1:[0-9a-f]{64}$/)
    assert.equal(row.reason, "unsubscribed")
    assert.equal(row.store_id, null)
  }
  assert.equal(graphCalls(out.hookRequests).length, 0, "no reply is sent")
  const hookTraffic = JSON.stringify(out.hookRequests)
  assert.equal(hookTraffic.includes("7700900123"), false)
  assert.equal(hookTraffic.includes("9876543210"), false)

  assert.deepEqual(out.after, { success: false, error: "whatsapp_opted_out", to: null })
  assert.equal(graphCalls(out.afterRequests).length, 0, "opted-out number is never sent to Meta")
  assert.equal(JSON.stringify(out.afterRequests).includes("7700900123"), false, "lookup uses the hash")

  assert.equal(out.other.success, true, "non-keyword reply does not opt out")
})

test("CartRenew: inbound STOP is ignored and sends never touch the suppression list", () => {
  const out = runChild("CartRenew", SCENARIO)

  assert.equal(out.before.success, true)
  assert.equal(dbCalls(out.beforeRequests).length, 0)
  assert.equal(out.hook.status, 200)
  assert.equal("opt_outs" in out.hook.body, false, "response shape unchanged")
  assert.equal(dbCalls(out.hookRequests).length, 0)
  assert.equal(out.after.success, true)
  assert.equal(dbCalls(out.afterRequests).length, 0)
  assert.equal(graphCalls(out.afterRequests).length, 1)
})

test("Pingza: without SUPPRESSION_HASH_SECRET the webhook returns 500 so Meta retries", () => {
  const out = runChild(
    "Pingza",
    `
      ${WEBHOOK_HELPERS}
      const hook = await webhook([{ from: "447700900123", type: "text", text: { body: "STOP" } }])
      console.log("RESULT:" + JSON.stringify({ hook, requests: take() }))
    `,
    { SUPPRESSION_HASH_SECRET: "" }
  )
  assert.equal(out.hook.status, 500)
  assert.equal(out.hook.body.opt_outs, 0)
  assert.equal(dbCalls(out.requests).length, 0)
})

test("an opted-out failure ends the cart as opted_out, others as lost", () => {
  const out = runChild(
    "Pingza",
    `
      const { recordCartSendFailure } = await load("./lib/services/recovery-dispatch.ts")
      await recordCartSendFailure("cart-1", "whatsapp_opted_out", { final: true })
      const optedOut = take()
      await recordCartSendFailure("cart-2", "phone_invalid", { final: true })
      const lost = take()
      console.log("RESULT:" + JSON.stringify({ optedOut, lost }))
    `
  )
  const statusPatch = (requests: Req[]) =>
    requests.find((r) => r.method === "PATCH" && r.url.includes("abandoned_carts") && r.body?.includes('"status"'))
  assert.deepEqual(JSON.parse(statusPatch(out.optedOut)?.body ?? "{}"), { status: "opted_out" })
  assert.deepEqual(JSON.parse(statusPatch(out.lost)?.body ?? "{}"), { status: "lost" })
})
