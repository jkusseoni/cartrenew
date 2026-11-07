import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (file: string) => readFileSync(path.join(root, file), "utf8")

test("header hides dashboard, login and sign up for non-default brands", () => {
  const navbar = read("components/Navbar.tsx")
  assert.match(navbar, /hiddenForCustomBrand = new Set\([^)]*"dashboard"/)
  const authBlocks = navbar.match(/\{brand\.isDefault \? \(/g) ?? []
  assert.equal(authBlocks.length, 2, "desktop and mobile auth links must both be gated")
})

test("sign-in and sign-up redirect home for non-default brands", () => {
  for (const file of ["app/[locale]/sign-in/layout.tsx", "app/[locale]/sign-up/layout.tsx"]) {
    const src = read(file)
    assert.match(src, /if \(!brand\.isDefault\)/, file)
    assert.match(src, /redirect\(\{ href: "\/", locale \}\)/, file)
  }
})

test("refund page uses Shopify-billed policy for non-default brands", () => {
  const src = read("app/[locale]/refund/page.tsx")
  assert.match(src, /if \(!brand\.isDefault\) return <ShopifyBilledRefundPolicy \/>/)
  const pingza = src.slice(src.indexOf("function ShopifyBilledRefundPolicy"), src.indexOf("export default"))
  assert.doesNotMatch(pingza, /Lifetime Deal|cross-border|cartrenew/i)
  assert.match(pingza, /Shopify Billing/)
})

test("support page hides docs link for non-default brands", () => {
  const src = read("app/[locale]/support/page.tsx")
  assert.match(src, /brand\.isDefault \? \(\s*<Link\s+href="\/docs"/)
})
