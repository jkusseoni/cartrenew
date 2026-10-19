import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"
import test, { type TestContext } from "node:test"
import { fileURLToPath } from "node:url"

import { summarizeInboundMessages } from "../lib/whatsapp/opt-out"
import {
  forwardOptOutWebhook,
  OPT_OUT_FORWARDED_HEADER,
  optOutForwardDecision,
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

/** Real Meta shape: a plain-text "STOP" typed as a reply to a template message (has `context`). */
const TEMPLATE_REPLY_STOP = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "102290129340398",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "15550783881", phone_number_id: "106540352242922" },
            contacts: [{ profile: { name: "Test Shopper" }, wa_id: PHONE_DIGITS }],
            messages: [
              {
                context: { from: "15550783881", id: "wamid.HBgLMTU1NTA3ODM4ODEVAgARGBI1RjQyNUE3NEYxMzAzMzQ5MkEA" },
                from: PHONE_DIGITS,
                id: "wamid.HBgLNDQ3NzAwOTAwMTIzFQIAEhgUM0E0QTY1OTlBRUUwMzgxMDE0NEYA",
                timestamp: "1760534400",
                text: { body: "STOP" },
                type: "text",
              },
            ],
          },
          field: "messages",
        },
      ],
    },
  ],
}

/** Meta pretty-prints and \u-escapes non-ASCII; the signature covers these exact bytes. */
const META_RAW_HINDI_STOP = `{"object":"whatsapp_business_account","entry":[{"id":"102290129340398","changes":[{"value":{"messaging_product":"whatsapp","messages":[{"context":{"from":"15550783881","id":"wamid.ctx"},"from":"${PHONE_DIGITS}","id":"wamid.in","timestamp":"1760534400","text":{"body":"\\u0930\\u094b\\u0915\\u094b"},"type":"text"}]},"field":"messages"}]}]}`

const decide = (overrides: Partial<Parameters<typeof optOutForwardDecision>[0]> = {}) =>
  optOutForwardDecision({
    isDefaultBrand: true,
    configuredUrl: FORWARD_URL,
    signatureVerified: true,
    signatureHeader: "sha256=abc",
    alreadyForwarded: false,
    body: STOP,
    ...overrides,
  })
const skipped = (reason: string) => ({ forward: false, reason })

test("forwards CartRenew payloads with an opt-out reply, with a reason for every skip", () => {
  assert.deepEqual(decide(), { forward: true, url: FORWARD_URL })
  assert.deepEqual(decide({ body: BUTTON_STOP }), { forward: true, url: FORWARD_URL })
  assert.deepEqual(decide({ body: TEMPLATE_REPLY_STOP }), { forward: true, url: FORWARD_URL })
  assert.deepEqual(decide({ body: JSON.parse(META_RAW_HINDI_STOP) }), { forward: true, url: FORWARD_URL })

  assert.deepEqual(decide({ isDefaultBrand: false }), skipped("not_cartrenew"))
  assert.deepEqual(decide({ alreadyForwarded: true }), skipped("already_forwarded"))
  assert.deepEqual(decide({ signatureVerified: false }), skipped("signature_unverified"))
  assert.deepEqual(decide({ signatureHeader: null }), skipped("signature_header_missing"))
  assert.deepEqual(decide({ body: NORMAL }), skipped("no_opt_out_keyword"))
  assert.deepEqual(decide({ body: STATUS_ONLY }), skipped("no_opt_out_keyword"))
  assert.deepEqual(
    decide({ body: messages([{ from: "12", type: "text", text: { body: "STOP" } }]) }),
    skipped("invalid_sender")
  )
  assert.deepEqual(decide({ configuredUrl: undefined }), skipped("env_unset"))
  assert.deepEqual(decide({ configuredUrl: "  " }), skipped("env_unset"))
  assert.deepEqual(decide({ configuredUrl: "http://pingza.test/hook" }), skipped("invalid_url"))
  assert.deepEqual(decide({ configuredUrl: "not a url" }), skipped("invalid_url"))
  assert.deepEqual(decide({ configuredUrl: "http://localhost:3001/api/whatsapp/webhook" }), {
    forward: true,
    url: "http://localhost:3001/api/whatsapp/webhook",
  })
})

test("inbound summary reports type, reply-to-template and keyword without PII", () => {
  assert.deepEqual(summarizeInboundMessages(TEMPLATE_REPLY_STOP), [
    { type: "text", isReply: true, optOutKeyword: true },
  ])
  assert.deepEqual(summarizeInboundMessages(BUTTON_STOP), [{ type: "button", isReply: false, optOutKeyword: true }])
  assert.deepEqual(summarizeInboundMessages(NORMAL), [{ type: "text", isReply: false, optOutKeyword: false }])
  assert.deepEqual(
    summarizeInboundMessages(messages([{ from: PHONE_DIGITS, type: "Weird Type!", text: { body: "x" } }])),
    [{ type: "other", isReply: false, optOutKeyword: false }]
  )
  assert.deepEqual(summarizeInboundMessages(STATUS_ONLY), [])
})

function captureLogs(t: TestContext) {
  const lines: string[] = []
  for (const level of ["log", "error"] as const) {
    t.mock.method(console, level, (...args: unknown[]) => {
      lines.push(args.map(String).join(" "))
    })
  }
  return lines
}

test("forward sends the original raw body and Meta signature", async (t) => {
  const lines = captureLogs(t)
  const raw = JSON.stringify(STOP)
  const calls: { url: string; init: RequestInit }[] = []
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response("{}", { status: 200 })
  }) as unknown as typeof fetch

  const forwarded = await forwardOptOutWebhook({
    url: FORWARD_URL,
    rawBody: raw,
    signature: "sha256=abc",
    fetchImpl,
  })

  assert.equal(forwarded, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, FORWARD_URL)
  assert.equal(calls[0].init.method, "POST")
  assert.equal(calls[0].init.body, raw)
  const headers = new Headers(calls[0].init.headers)
  assert.equal(headers.get("x-hub-signature-256"), "sha256=abc")
  assert.equal(headers.get(OPT_OUT_FORWARDED_HEADER), "1")
  assert.ok(calls[0].init.signal, "request has a timeout signal")
  assert.match(lines[0], /^\[whatsapp-webhook\] forward attempted status=200 duration_ms=\d+$/)
})

test("forward failures and timeouts return false and log without phone numbers", async (t) => {
  const lines = captureLogs(t)
  const raw = JSON.stringify(STOP)

  const rejecting = (async () => {
    throw new TypeError(`fetch failed for ${PHONE_DIGITS}`, { cause: { code: "ENOTFOUND" } })
  }) as unknown as typeof fetch
  const rejected = await forwardOptOutWebhook({
    url: FORWARD_URL,
    rawBody: raw,
    signature: "sha256=abc",
    fetchImpl: rejecting,
  })

  const non2xx = (async () => new Response("no", { status: 401 })) as unknown as typeof fetch
  const unauthorized = await forwardOptOutWebhook({
    url: FORWARD_URL,
    rawBody: raw,
    signature: "sha256=abc",
    fetchImpl: non2xx,
  })

  const hanging = ((_: string, init: RequestInit) =>
    new Promise((_, reject) => {
      const safety = setTimeout(() => reject(new Error("forward did not abort")), 2_000)
      init.signal?.addEventListener("abort", () => {
        clearTimeout(safety)
        reject(init.signal?.reason)
      }, { once: true })
    })) as unknown as typeof fetch
  const started = Date.now()
  const timedOut = await forwardOptOutWebhook({
    url: FORWARD_URL,
    rawBody: raw,
    signature: "sha256=abc",
    fetchImpl: hanging,
    timeoutMs: 30,
  })
  assert.ok(Date.now() - started < 2_000, "timeout cuts the request")

  assert.equal(rejected, false)
  assert.equal(unauthorized, false)
  assert.equal(timedOut, false)
  assert.match(lines[0], /forward attempted error=TypeError cause=ENOTFOUND duration_ms=/)
  assert.match(lines[1], /forward attempted status=401 duration_ms=/)
  assert.match(lines[2], /forward attempted error=TimeoutError duration_ms=/)
  assert.equal(lines.some((l) => l.includes(PHONE_DIGITS)), false)
})

// Route-level runs in child processes (brand is frozen at import). fetch is
// stubbed before the route loads; the Pingza forward target can accept,
// reject or hang. Console output is captured per call.
const CHILD = `
  const crypto = await import("node:crypto")
  const requests = []
  const logs = []
  for (const level of ["log", "warn", "error"]) {
    const original = console[level].bind(console)
    console[level] = (...args) => {
      logs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "))
      original(...args)
    }
  }
  const json = (value, status = 200) =>
    new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } })
  const abortTimeout = AbortSignal.timeout.bind(AbortSignal)
  AbortSignal.timeout = (ms) => abortTimeout(Math.min(ms, 30))
  globalThis.__forwardMode = "ok"
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url ?? String(input)
    const method = (init.method || "GET").toUpperCase()
    const headers = Object.fromEntries(new Headers(init.headers).entries())
    requests.push({ url, method, body: typeof init.body === "string" ? init.body : null, headers })
    if (url.startsWith("https://pingza.test")) {
      if (globalThis.__forwardMode === "reject") throw new TypeError("fetch failed")
      if (globalThis.__forwardMode === "non2xx") return json({ error: "unavailable" }, 503)
      if (globalThis.__forwardMode === "hang") {
        return new Promise((_, reject) => {
          const safety = setTimeout(() => reject(new Error("forward did not abort")), 2_000)
          init.signal?.addEventListener("abort", () => {
            clearTimeout(safety)
            reject(init.signal.reason)
          }, { once: true })
        })
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
  async function callRaw(raw, { signature, headers = {} } = {}) {
    const sig = signature === undefined ? sign(raw) : signature
    logs.splice(0)
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
      logs: logs.splice(0),
      forwards: sent.filter((r) => r.url.startsWith("https://pingza.test")),
      suppressionWrites: sent.filter((r) => r.method === "POST" && r.url.includes("email_suppressions")).length,
    }
  }
  const call = (payload, options) => callRaw(JSON.stringify(payload), options)
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
  return JSON.parse(line.slice("RESULT:".length))
}

type CallResult = { logs: string[] }

function assertPiiFree(name: string, result: CallResult) {
  for (const line of result.logs) {
    assert.equal(line.includes(PHONE_DIGITS), false, `${name}: phone number in log: ${line}`)
    assert.equal(/stop|रोको|where is my order/i.test(line), false, `${name}: message text in log: ${line}`)
  }
}

const hasLog = (result: CallResult, pattern: RegExp) => result.logs.some((l) => pattern.test(l))

test("CartRenew route: awaits STOP forwarding and returns 5xx on retryable failure", () => {
  const out = runChild(
    "CartRenew",
    `
      const stop = ${JSON.stringify(STOP)}
      const templateReply = ${JSON.stringify(TEMPLATE_REPLY_STOP)}
      const normal = ${JSON.stringify(NORMAL)}
      const statusOnly = ${JSON.stringify(STATUS_ONLY)}

      process.env.PINGZA_WEBHOOK_FORWARD_URL = ""
      const unset = await call(stop)

      process.env.PINGZA_WEBHOOK_FORWARD_URL = "${FORWARD_URL}"
      const forwarded = await call(stop)
      const template = await call(templateReply)
      const metaRaw = await callRaw(${JSON.stringify(META_RAW_HINDI_STOP)})
      const normalMsg = await call(normal)
      const statusMsg = await call(statusOnly)
      const again = await call(stop, { headers: { "${OPT_OUT_FORWARDED_HEADER}": "1" } })

      globalThis.__forwardMode = "reject"
      const rejected = await call(stop)

      globalThis.__forwardMode = "non2xx"
      const non2xx = await call(stop)

      globalThis.__forwardMode = "hang"
      const hanging = await call(stop)

      console.log("RESULT:" + JSON.stringify({
        unset, forwarded, template, metaRaw, normalMsg, statusMsg, again, rejected, non2xx, hanging
      }))
    `
  )

  assert.equal(out.unset.status, 200)
  assert.equal(out.unset.forwards.length, 0, "env unset: no forward")
  assert.ok(hasLog(out.unset, /^\[whatsapp-webhook\] forward skipped reason=env_unset$/))

  for (const name of ["forwarded", "template", "metaRaw"]) {
    assert.equal(out[name].forwards.length, 1, name)
    const fwd = out[name].forwards[0]
    assert.equal(fwd.method, "POST")
    assert.equal(fwd.body, out[name].raw, `${name}: original raw body`)
    assert.equal(fwd.headers["x-hub-signature-256"], out[name].sig, `${name}: original Meta signature`)
    assert.equal(fwd.headers[OPT_OUT_FORWARDED_HEADER], "1")
    assert.ok(hasLog(out[name], /^\[whatsapp-webhook\] signature verified=true forwarded=false$/), name)
    assert.ok(hasLog(out[name], /^\[whatsapp-webhook\] opt-out keyword detected=true$/), name)
    assert.ok(hasLog(out[name], /^\[whatsapp-webhook\] forward attempted status=200 duration_ms=\d+$/), name)
    assert.equal(out[name].status, 200, name)
    assert.deepEqual(out[name].body, out.unset.body, `${name}: successful response unchanged`)
  }
  assert.ok(hasLog(out.forwarded, /^\[whatsapp-webhook\] inbound message received \(type=text, reply=false\)$/))
  assert.ok(hasLog(out.template, /^\[whatsapp-webhook\] inbound message received \(type=text, reply=true\)$/))

  assert.equal(out.normalMsg.forwards.length, 0, "normal message")
  assert.ok(hasLog(out.normalMsg, /opt-out keyword detected=false$/))
  assert.ok(hasLog(out.normalMsg, /forward skipped reason=no_opt_out_keyword$/))
  assert.equal(out.statusMsg.forwards.length, 0, "status update")
  assert.equal(
    hasLog(out.statusMsg, /inbound message|keyword detected|forward (skipped|attempted)/),
    false,
    "status update stays quiet"
  )
  assert.equal(out.again.forwards.length, 0, "already-forwarded request")
  assert.ok(hasLog(out.again, /forward skipped reason=already_forwarded$/))

  for (const name of ["forwarded", "template", "metaRaw", "rejected", "non2xx", "hanging"]) {
    assert.equal(out[name].suppressionWrites, 0, `${name}: CartRenew records nothing`)
  }
  for (const name of ["rejected", "non2xx", "hanging"]) {
    assert.equal(out[name].status, 500, name)
    assert.equal(out[name].body.success, false, name)
    assert.equal(out[name].body.errors, 1, name)
    assert.equal(out[name].forwards.length, 1, name)
  }
  assert.ok(hasLog(out.rejected, /^\[whatsapp-webhook\] forward attempted error=TypeError duration_ms=\d+$/))
  assert.ok(hasLog(out.non2xx, /^\[whatsapp-webhook\] forward attempted status=503 duration_ms=\d+$/))
  assert.ok(hasLog(out.hanging, /^\[whatsapp-webhook\] forward attempted error=TimeoutError duration_ms=\d+$/))

  for (const [name, result] of Object.entries(out)) assertPiiFree(name, result as CallResult)
})

test("Pingza route: verifies the Meta signature before recording, and never forwards", () => {
  const out = runChild(
    "Pingza",
    `
      const stop = ${JSON.stringify(TEMPLATE_REPLY_STOP)}
      const forwardedHeader = { "${OPT_OUT_FORWARDED_HEADER}": "1" }
      const bad = await call(stop, { signature: "sha256=" + "0".repeat(64), headers: forwardedHeader })
      const otherSecret = await call(stop, { signature: sign(JSON.stringify(stop), "another-secret"), headers: forwardedHeader })
      const missing = await call(stop, { signature: null, headers: forwardedHeader })
      const good = await call(stop, { headers: forwardedHeader })
      const metaRaw = await callRaw(${JSON.stringify(META_RAW_HINDI_STOP)}, { headers: forwardedHeader })
      console.log("RESULT:" + JSON.stringify({ bad, otherSecret, missing, good, metaRaw }))
    `,
    { PINGZA_WEBHOOK_FORWARD_URL: FORWARD_URL }
  )

  for (const name of ["bad", "otherSecret", "missing"]) {
    assert.equal(out[name].status, 401, name)
    assert.deepEqual(out[name].body, { error: "Invalid signature" }, name)
    assert.equal(out[name].suppressionWrites, 0, `${name}: nothing recorded`)
    assert.ok(hasLog(out[name], /^\[whatsapp-webhook\] signature verified=false forwarded=true$/), name)
    assert.equal(hasLog(out[name], /opt-out recorded/), false, name)
  }
  assert.ok(hasLog(out.bad, /^\[whatsapp-webhook\] rejected: signature \(header=invalid\) forwarded=true$/))
  assert.ok(hasLog(out.missing, /^\[whatsapp-webhook\] rejected: signature \(header=missing\) forwarded=true$/))

  for (const name of ["good", "metaRaw"]) {
    assert.equal(out[name].status, 200, name)
    assert.equal(out[name].body.opt_outs, 1, name)
    assert.equal(out[name].suppressionWrites, 1, name)
    assert.ok(hasLog(out[name], /^\[whatsapp-webhook\] signature verified=true forwarded=true$/), name)
    assert.ok(hasLog(out[name], /^\[whatsapp-webhook\] inbound message received \(type=text, reply=true\)$/), name)
    assert.ok(hasLog(out[name], /^\[whatsapp-webhook\] opt-out keyword detected=true$/), name)
    assert.ok(hasLog(out[name], /^\[whatsapp-webhook\] opt-out recorded$/), name)
  }
  for (const [name, result] of Object.entries(out)) {
    assert.equal((result as { forwards: unknown[] }).forwards.length, 0, `${name}: Pingza never forwards`)
    assert.equal(hasLog(result as CallResult, /forward (scheduled|skipped|attempted)/), false, name)
    assertPiiFree(name, result as CallResult)
  }
})

test("Pingza route: an unsigned body (no app secret, local dev) never records an opt-out", () => {
  const out = runChild(
    "Pingza",
    `console.log("RESULT:" + JSON.stringify({ unsigned: await call(${JSON.stringify(STOP)}, { signature: null }) }))`,
    { WHATSAPP_APP_SECRET: "", NODE_ENV: "test" }
  )
  assert.equal(out.unsigned.status, 200)
  assert.equal(out.unsigned.body.opt_outs, 0)
  assert.equal(out.unsigned.suppressionWrites, 0)
  assert.ok(hasLog(out.unsigned, /opt-out not recorded reason=signature_unverified$/))
  assertPiiFree("unsigned", out.unsigned)
})
