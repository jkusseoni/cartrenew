import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (file: string) => readFileSync(path.join(root, file), "utf8")

test("uninstall keeps recovered carts recovered for Pingza only", () => {
  const src = read("app/api/webhooks/shopify/route.ts")
  const fn = src.slice(src.indexOf("async function handleAppUninstalled"))
  assert.match(fn, /if \(!brand\.isDefault\) lostQuery = lostQuery\.neq\('status', 'recovered'\)/)
})

test("cart delete never rewrites a recovered Pingza cart to lost", () => {
  const src = read("app/api/webhooks/shopify/route.ts")
  assert.match(src, /if \(!brand\.isDefault && cart\.status === 'recovered'\) return/)
})

test("Pingza dashboard totals come from abandoned_carts, CartRenew keeps analytics_daily", () => {
  const src = read("lib/shopify/dashboard.ts")
  assert.match(src, /\.from\("analytics_daily"\)/)
  const block = src.slice(src.indexOf("if (!brand.isDefault) {\n      const { data: allCarts"))
  assert.match(block, /\.from\("abandoned_carts"\)/)
  assert.match(block, /metrics\.recovered \+= 1/)
})
