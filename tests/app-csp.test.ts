import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { buildAppCsp } from "../lib/app-csp"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

// Exact header proxy.ts sent before Pingza Clerk hosts were added.
const CARTRENEW_CSP =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com https://challenges.cloudflare.com https://clerk.cartrenew.com https://*.clerk.accounts.dev https://*.clerk.com; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com data:; " +
  "img-src 'self' data: blob: https://images.unsplash.com https://img.clerk.com https://graph.facebook.com https://api.producthunt.com https://peerpush.com https://clerk.cartrenew.com https://*.clerk.accounts.dev https://*.clerk.com; " +
  "connect-src 'self' https://generativelanguage.googleapis.com https://graph.facebook.com https://clerk.cartrenew.com https://*.clerk.accounts.dev https://*.clerk.com; " +
  "frame-src 'self' https://challenges.cloudflare.com https://clerk.cartrenew.com https://*.clerk.accounts.dev https://*.clerk.com; " +
  "worker-src 'self' blob:; " +
  "child-src 'self' blob:;"

function directive(csp: string, name: string): string {
  const part = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `))
  assert.ok(part, `missing ${name}`)
  return part
}

test("CartRenew CSP is byte-for-byte unchanged", () => {
  assert.equal(buildAppCsp(true), CARTRENEW_CSP)
  assert.equal(buildAppCsp(true).includes("pingza.app"), false)
})

test("Pingza CSP allows its Clerk frontend API and account portal", () => {
  const csp = buildAppCsp(false)
  for (const name of ["script-src", "connect-src", "frame-src", "img-src"]) {
    const value = directive(csp, name)
    assert.match(value, /https:\/\/clerk\.pingza\.app(\s|$)/, `${name} lacks clerk.pingza.app`)
    assert.match(value, /https:\/\/accounts\.pingza\.app(\s|$)/, `${name} lacks accounts.pingza.app`)
  }
})

test("Pingza CSP keeps every CartRenew source", () => {
  const tokens = (csp: string) => csp.split(/[\s;]+/).filter(Boolean)
  const cartrenew = tokens(buildAppCsp(true))
  const pingza = new Set(tokens(buildAppCsp(false)))
  for (const token of cartrenew) assert.ok(pingza.has(token), `Pingza CSP dropped ${token}`)
})

test("proxy sets the brand-aware CSP", () => {
  const proxy = fs.readFileSync(path.join(root, "proxy.ts"), "utf8")
  assert.match(proxy, /buildAppCsp\(brand\.isDefault\)/)
  assert.equal(proxy.includes("https://clerk.cartrenew.com"), false)
})
