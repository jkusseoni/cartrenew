import assert from "node:assert/strict"
import test, { type TestContext } from "node:test"

import { authFetch } from "../lib/shopify/authFetch"

type FetchInit = RequestInit & { timeoutMs?: number }

// fetch that never answers and rejects on abort, like the real one.
function installBrowser(t: TestContext) {
  const calls: { url: string; init: FetchInit }[] = []
  const hadWindow = "window" in globalThis
  const realFetch = globalThis.fetch

  Object.assign(globalThis, {
    window: {
      shopify: { idToken: async () => "session-token" },
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    },
    fetch: (url: string, init: FetchInit) => {
      calls.push({ url, init })
      return new Promise((_, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")))
      })
    },
  })

  t.after(() => {
    globalThis.fetch = realFetch
    if (!hadWindow) Reflect.deleteProperty(globalThis, "window")
  })
  return calls
}

const flush = () => new Promise((resolve) => setImmediate(resolve))

function track(promise: Promise<unknown>) {
  const state: { settled: boolean; error: string | null } = { settled: false, error: null }
  promise.then(
    () => {
      state.settled = true
    },
    (error: Error) => {
      state.settled = true
      state.error = error.message
    }
  )
  return state
}

test("authFetch times out after 8000 ms by default", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const calls = installBrowser(t)

  const state = track(authFetch("/api/app/dashboard"))
  await flush()
  assert.equal(calls.length, 1)
  assert.equal(new Headers(calls[0].init.headers).get("Authorization"), "Bearer session-token")

  t.mock.timers.tick(7_999)
  await flush()
  assert.equal(state.settled, false)

  t.mock.timers.tick(1)
  await flush()
  assert.equal(state.error, "Shopify request timed out")
})

test("authFetch honours timeoutMs and doesn't pass it to fetch", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const calls = installBrowser(t)

  const state = track(authFetch("/api/shopify/test-message", { method: "POST", timeoutMs: 30_000 }))
  await flush()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].init.method, "POST")
  assert.equal("timeoutMs" in calls[0].init, false)

  t.mock.timers.tick(8_000)
  await flush()
  assert.equal(state.settled, false, "still waiting past the 8s default")

  t.mock.timers.tick(21_999)
  await flush()
  assert.equal(state.settled, false)

  t.mock.timers.tick(1)
  await flush()
  assert.equal(state.error, "Shopify request timed out")
})
