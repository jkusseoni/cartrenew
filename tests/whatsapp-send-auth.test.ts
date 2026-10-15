import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { checkServerSecret } from "../lib/api-auth"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SECRET = "test-admin-secret-value"

test("checkServerSecret accepts the secret only from headers", () => {
  const h = (init: Record<string, string>) => new Headers(init)
  assert.equal(checkServerSecret(h({ "x-admin-secret": SECRET }), SECRET), "ok")
  assert.equal(checkServerSecret(h({ authorization: `Bearer ${SECRET}` }), SECRET), "ok")
  assert.equal(checkServerSecret(h({ "x-admin-secret": ` ${SECRET} ` }), ` ${SECRET}\n`), "ok")
  assert.equal(checkServerSecret(h({}), SECRET), "unauthorized")
  assert.equal(checkServerSecret(h({ "x-admin-secret": "wrong" }), SECRET), "unauthorized")
  assert.equal(checkServerSecret(h({ "x-admin-secret": `${SECRET}x` }), SECRET), "unauthorized")
  assert.equal(checkServerSecret(h({ authorization: SECRET }), SECRET), "unauthorized")
  assert.equal(checkServerSecret(h({ "x-admin-secret": SECRET }), undefined), "not_configured")
  assert.equal(checkServerSecret(h({ "x-admin-secret": "" }), "  "), "not_configured")
})

// fetch is stubbed before the route loads: Graph API accepts, Supabase
// (Pingza's opt-out lookup) returns no rows.
const SCRIPT = `
  const requests = []
  const json = (value, status = 200) =>
    new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } })
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url ?? String(input)
    requests.push(url)
    if (url.includes("graph.facebook.com")) return json({ messages: [{ id: "wamid.test" }], contacts: [{}] })
    return json([])
  }
  const mod = await import("./app/api/whatsapp/send/route.ts")
  const { POST } = { ...(mod.default ?? {}), ...mod }
  const payload = JSON.stringify({ phone: "+447700900123", checkoutUrl: "https://shop.test/cart", customerName: "Asha" })
  async function call(url, headers = {}) {
    const res = await POST(new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: payload }))
    const graph = requests.splice(0).filter((u) => u.includes("graph.facebook.com")).length
    return { status: res.status, body: await res.json(), graph }
  }
  const base = "http://localhost/api/whatsapp/send"
  console.log("RESULT:" + JSON.stringify({
    none: await call(base),
    wrong: await call(base, { "x-admin-secret": "wrong" }),
    query: await call(base + "?secret=${SECRET}&admin_secret=${SECRET}"),
    header: await call(base, { "x-admin-secret": "${SECRET}" }),
    bearer: await call(base, { authorization: "Bearer ${SECRET}" }),
  }))
`

function runRoute(appName: string, env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", SCRIPT], {
    cwd: root,
    env: {
      ...process.env,
      NEXT_PUBLIC_APP_NAME: appName,
      ADMIN_PROCESS_SECRET: SECRET,
      NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
      SUPPRESSION_HASH_SECRET: "test-hash-secret",
      WHATSAPP_ACCESS_TOKEN: "test-access-token",
      WHATSAPP_PHONE_NUMBER_ID: "1234567890",
      ...env,
    },
    encoding: "utf8",
  })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  const line = result.stdout.split(/\r?\n/).find((l) => l.startsWith("RESULT:"))
  assert.ok(line, `${result.stdout}\n${result.stderr}`)
  return JSON.parse(line.slice("RESULT:".length))
}

for (const appName of ["CartRenew", "Pingza"]) {
  test(`${appName}: /api/whatsapp/send sends only with the server secret header`, () => {
    const out = runRoute(appName)
    for (const name of ["none", "wrong", "query"]) {
      assert.deepEqual(out[name], { status: 401, body: { error: "Unauthorized" }, graph: 0 }, name)
    }
    for (const name of ["header", "bearer"]) {
      assert.equal(out[name].status, 200, name)
      assert.equal(out[name].body.success, true, name)
      assert.equal(out[name].graph, 1, name)
    }
  })
}

test("no development bypass, and an unset secret fails closed", () => {
  const dev = runRoute("CartRenew", { NODE_ENV: "development" })
  assert.equal(dev.none.status, 401)
  assert.equal(dev.none.graph, 0)

  const unset = runRoute("Pingza", { ADMIN_PROCESS_SECRET: "" })
  for (const name of ["none", "header", "bearer"]) {
    assert.equal(unset[name].status, 500, name)
    assert.equal(unset[name].graph, 0, name)
    assert.equal(JSON.stringify(unset[name].body).includes(SECRET), false)
  }
})

test("the cart poller scripts send the secret header", () => {
  for (const file of ["scripts/cartPoller.js", "dist-scripts/cartPoller.js"]) {
    const src = fs.readFileSync(path.join(root, file), "utf8")
    assert.match(src, /"x-admin-secret":/, file)
    assert.match(src, /process\.env\.ADMIN_PROCESS_SECRET/, file)
  }
})
