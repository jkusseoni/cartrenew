import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"
import test, { type TestContext } from "node:test"
import { fileURLToPath } from "node:url"

import {
  forwardOptOutWebhook,
  OPT_OUT_FORWARDED_HEADER,
  optOutForwardTarget,
} from "../lib/whatsapp/opt-out-forward"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const FORWARD_URL = "https://pingza.test/api/whatsapp/webhook"
const PHONE_DIGITS = "447700900123"

const messages = (list: unknown[]) => ({
  object: "whatsapp_business_account",
  entry: [{ changes: [{ field: "messages", value: { messages: list } }] }],
})
const STOP = messages([{ from: PHONE_DIGITS, type: "text", text: { body: " Stop " } }])
const BUTTON_STOP = messages([{ from: PHONE_DIGITS, type: "button", button: { text: "Unsubscribe" } }])
const NORMAL = messages([{ from: PHONE_DIGITS, type: "text", text: { body: "where is my order?" } }])
const STATUS_ONLY = {
  entry: [{ changes: [{ field: "messages", value: { statuses: [{ id: "wamid.1", status: "read", timestamp: "1" }] } }] }],
}

const target = (overrides: Partial<Parameters<typeof optOutForwardTarget>[0]> = {}) =>
  optOutForwardTarget({
    isDefaultBrand: true,
    configuredUrl: FORWARD_URL,
    signatureVerified: true,
    alreadyForwarded: false,
    body: STOP,
    ...overrides,
  })

test("forwards only CartRenew payloads with an opt-out reply", () => {
  assert.equal(target(), FORWARD_URL)
  assert.equal(target({ body: BUTTON_STOP }), FORWARD_URL)
  assert.equal(target({ body: NORMAL }), null, "normal message")
  assert.equal(target({ body: STATUS_ONLY }), null, "status update")
  assert.equal(target({ configuredUrl: undefined }), null, "env unset")
  assert.equal(target({ configuredUrl: "  " }), null, "env blank")
  assert.equal(target({ isDefaultBrand: false }), null, "Pingza never forwards")
  assert.equal(target({ alreadyForwarded: true }), null, "no second hop")
  assert.equal(target({ signatureVerified: false }), null, "unsigned body")
})

test("forward URL must be https (http only for localhost)", (t) => {
  t.mock.method(console, "error", () => undefined)
  assert.equal(target({ configuredUrl: "http://pingza.test/hook" }), null)
  assert.equal(target({ configuredUrl: "not a url" }), null)
  assert.equal(target({ configuredUrl: "http://localhost:3001/api/whatsapp/webhook" }), "http://localhost:3001/api/whatsapp/webhook")
})

function captureLogs(t: TestContext) {
  const lines: string[] = []
  for (const level of ["log", "error"] as const) {
    t.mock.method(console, level, (...args: unknown[]) => {
      lines.push(JSON.stringify(args))
    })
  }
  return lines
}

test("forward sends the original raw body and Meta signature", async (t) => {
  captureLogs(t)
  const raw = JSON.stringify(STOP)
  const calls: { url: string; init: RequestInit }[] = []
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response("{}", { status: 200 })
  }) as unknown as typeof fetch

  await forwardOptOutWebhook({ url: FORWARD_URL, rawBody: raw, signature: "sha256=abc", fetchImpl })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, FORWARD_URL)
  assert.equal(calls[0].init.method, "POST")
  assert.equal(calls[0].init.body, raw)
  const headers = new Headers(calls[0].init.headers)
  assert.equal(headers.get("x-hub-signature-256"), "sha256=abc")
  assert.equal(headers.get(OPT_OUT_FORWARDED_HEADER), "1")
  assert.ok(calls[0].init.signal, "request has a timeout signal")
})

test("forward failures and timeouts are logged without phone numbers and never throw", async (t) => {
  const lines = captureLogs(t)
  const raw = JSON.stringify(STOP)

  const rejecting = (async () => {
    throw new TypeError(`fetch failed for ${PHONE_DIGITS}`)
  }) as unknown as typeof fetch
  await forwardOptOutWebhook({ url: FORWARD_URL, rawBody: raw, signature: "sha256=abc", fetchImpl: rejecting })

  const non2xx = (async () => new Response("no", { status: 401 })) as unknown as typeof fetch
  await forwardOptOutWebhook({ url: FORWARD_URL, rawBody: raw, signature: "sha256=abc", fetchImpl: non2xx })

  const hanging = ((_: string, init: RequestInit) =>
    new Promise((_, reject) => {
      init.signal?.addEventListener("abort", () => reject(init.signal?.reason))
    })) as unknown as typeof fetch
  const started = Date.now()
  await forwardOptOutWebhook({ url: FORWARD_URL, rawBody: raw, signature: "sha256=abc", fetchImpl: hanging, timeoutMs: 30 })
  assert.ok(Date.now() - started < 2_000, "timeout cuts the request")

  assert.match(lines[0], /"error":"TypeError"/)
  assert.match(lines[1], /"status":401/)
  assert.match(lines[2], /"error":"TimeoutError"/)
  assert.equal(lines.some((l) => l.includes(PHONE_DIGITS)), false)
})

// Route-level runs in child processes (brand is frozen at import). fetch is
// stubbed before the route loads; the Pingza forward target can accept,
// reject or hang.
const CHILD = `
  const crypto = await import("node:crypto")
  const requests = []
  const json = (value, status = 200) =>
    new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } })
  globalThis.__forwardMode = "ok"
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url ?? String(input)
    const method = (init.method || "GET").toUpperCase()
    const headers = Object.fromEntries(new Headers(init.headers).entries())
    requests.push({ url, method, body: typeof init.body === "string" ? init.body : null, headers })
    if (url.startsWith("https://pingza.test")) {
      if (globalThis.__forwardMode === "reject") throw new TypeError("fetch failed")
      if (globalThis.__forwardMode === "hang") {
        return new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal.reason)))
      }
      return json({ success: true })
    }
    return json([], method === "POST" ? 201 : 200)
  }
  const mod = await import("./app/api/whatsapp/webhook/route.ts")
  const { POST } = { ...(mod.default ?? {}), ...mod }
  const { NextRequest } = await import("next/server")
  const settle = () => new Promise((r) => setTimeout(r, 50))
  const sign = (raw, secret = "test-app-secret") =>
    "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex")
  async function call(payload, { signature, headers = {} } = {}) {
    const raw = JSON.stringify(payload)
    const sig = signature === undefined ? sign(raw) : signature
    const started = Date.now()
    const res = await POST(new NextRequest("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", ...(sig ? { "x-hub-signature-256": sig } : {}), ...headers },
      body: raw,
    }))
    const ms = Date.now() - started
    const body = await res.json()
    await settle()
    const sent = requests.splice(0)
    return {
      status: res.status,
      body,
      ms,
      raw,
      sig,
      forwards: sent.filter((r) => r.url.startsWith("https://pingza.test")),
      suppressionWrites: sent.filter((r) => r.method === "POST" && r.url.includes("email_suppressions")).length,
    }
  }
`

function runChild(appName: string, script: string, env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `${CHILD}\n${script}`], {
    cwd: root,
    env: {
      ...process.env,
      NEXT_PUBLIC_APP_NAME: appName,
      WHATSAPP_APP_SECRET: "test-app-secret",
      NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
      SUPPRESSION_HASH_SECRET: "test-hash-secret",
      PINGZA_WEBHOOK_FORWARD_URL: "",
      ...env,
    },
    encoding: "utf8",
  })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  const line = result.stdout.split(/\r?\n/).find((l) => l.startsWith("RESULT:"))
  assert.ok(line, `${result.stdout}\n${result.stderr}`)
  return { out: JSON.parse(line.slice("RESULT:".length)), stdout: result.stdout, stderr: result.stderr }
}

test("CartRenew route: forwards STOP only, response identical with or without forwarding", () => {
  const { out, stdout, stderr } = runChild(
    "CartRenew",
    `
      const stop = ${JSON.stringify(STOP)}
      const normal = ${JSON.stringify(NORMAL)}
      const statusOnly = ${JSON.stringify(STATUS_ONLY)}

      process.env.PINGZA_WEBHOOK_FORWARD_URL = ""
      const unset = await call(stop)

      process.env.PINGZA_WEBHOOK_FORWARD_URL = "${FORWARD_URL}"
      const forwarded = await call(stop)
      const normalMsg = await call(normal)
      const statusMsg = await call(statusOnly)
      const again = await call(stop, { headers: { "${OPT_OUT_FORWARDED_HEADER}": "1" } })

      globalThis.__forwardMode = "reject"
      const rejected = await call(stop)

      globalThis.__forwardMode = "hang"
      const hanging = await call(stop)

      console.log("RESULT:" + JSON.stringify({ unset, forwarded, normalMsg, statusMsg, again, rejected, hanging }))
    `
  )

  assert.equal(out.unset.status, 200)
  assert.equal(out.unset.forwards.length, 0, "env unset: no forward")

  assert.equal(out.forwarded.forwards.length, 1)
  const fwd = out.forwarded.forwards[0]
  assert.equal(fwd.method, "POST")
  assert.equal(fwd.body, out.forwarded.raw, "original raw body")
  assert.equal(fwd.headers["x-hub-signature-256"], out.forwarded.sig, "original Meta signature")
  assert.equal(fwd.headers[OPT_OUT_FORWARDED_HEADER], "1")

  assert.equal(out.normalMsg.forwards.length, 0, "normal message")
  assert.equal(out.statusMsg.forwards.length, 0, "status update")
  assert.equal(out.again.forwards.length, 0, "already-forwarded request")

  for (const name of ["forwarded", "rejected", "hanging"]) {
    assert.equal(out[name].status, out.unset.status, name)
    assert.deepEqual(out[name].body, out.unset.body, `${name}: response body unchanged`)
    assert.equal(out[name].suppressionWrites, 0, `${name}: CartRenew records nothing`)
  }
  assert.equal(out.rejected.forwards.length, 1)
  assert.equal(out.hanging.forwards.length, 1)
  assert.ok(out.hanging.ms < 1_000, "response does not wait for the forward")

  const logs = (stdout + stderr)
    .split(/\r?\n/)
    .filter((l) => !l.startsWith("RESULT:"))
    .join("\n")
  assert.match(logs, /opt-out forward to Pingza failed/)
  assert.equal(logs.includes(PHONE_DIGITS), false, "no phone numbers in logs")
})

test("Pingza route: verifies the Meta signature before recording, and never forwards", () => {
  const { out } = runChild(
    "Pingza",
    `
      const stop = ${JSON.stringify(STOP)}
      const forwardedHeader = { "${OPT_OUT_FORWARDED_HEADER}": "1" }
      const bad = await call(stop, { signature: "sha256=" + "0".repeat(64), headers: forwardedHeader })
      const otherSecret = await call(stop, { signature: sign(JSON.stringify(stop), "another-secret"), headers: forwardedHeader })
      const missing = await call(stop, { signature: null, headers: forwardedHeader })
      const good = await call(stop, { headers: forwardedHeader })
      console.log("RESULT:" + JSON.stringify({ bad, otherSecret, missing, good }))
    `,
    { PINGZA_WEBHOOK_FORWARD_URL: FORWARD_URL }
  )

  for (const name of ["bad", "otherSecret", "missing"]) {
    assert.equal(out[name].status, 401, name)
    assert.deepEqual(out[name].body, { error: "Invalid signature" }, name)
    assert.equal(out[name].suppressionWrites, 0, `${name}: nothing recorded`)
  }
  assert.equal(out.good.status, 200)
  assert.equal(out.good.body.opt_outs, 1)
  assert.equal(out.good.suppressionWrites, 1)
  for (const name of ["bad", "otherSecret", "missing", "good"]) {
    assert.equal(out[name].forwards.length, 0, `${name}: Pingza never forwards`)
  }
})

test("Pingza route: an unsigned body (no app secret, local dev) never records an opt-out", () => {
  const { out } = runChild(
    "Pingza",
    `console.log("RESULT:" + JSON.stringify({ unsigned: await call(${JSON.stringify(STOP)}, { signature: null }) }))`,
    { WHATSAPP_APP_SECRET: "", NODE_ENV: "test" }
  )
  assert.equal(out.unsigned.status, 200)
  assert.equal(out.unsigned.body.opt_outs, 0)
  assert.equal(out.unsigned.suppressionWrites, 0)
})
