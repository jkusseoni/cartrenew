import assert from "node:assert/strict"
import test from "node:test"

import { permanentEmailSkipError } from "../lib/email/email-skip"
import {
  recoveryEmailSubject,
  recoveryFromName,
  recoveryStoreDisplayName,
  renderRecoveryEmail,
} from "../lib/email/template"
import {
  UNSUBSCRIBE_CONFIRMATION,
  unsubscribePostFormat,
} from "../lib/email/unsubscribe-format"
import { checkoutUrlForLog, maskEmailForLog, shopifyCheckoutLog, tokenSuffix } from "../lib/log-safe"

test("shopify checkout log keeps a token suffix and contact booleans", () => {
  const entry = shopifyCheckoutLog({
    topic: "checkouts/update",
    shop: "demo.myshopify.com",
    checkoutToken: "abcdef123456",
    lineItemCount: 2,
    hasEmail: true,
    hasPhone: false,
  })
  assert.equal(entry.checkoutTokenSuffix, "123456")
  assert.equal(entry.hasEmail, true)
  assert.equal(entry.hasPhone, false)
  assert.equal(JSON.stringify(entry).includes("abcdef"), false)
  assert.equal(tokenSuffix("abc"), "abc")
  assert.equal(tokenSuffix(null), null)
})

test("checkout urls and emails are masked for logs", () => {
  assert.equal(
    checkoutUrlForLog("https://shop.example/cart?key=secret-token"),
    "https://shop.example/cart"
  )
  assert.equal(maskEmailForLog("shopper@example.com"), "s***@example.com")
  assert.equal(JSON.stringify(checkoutUrlForLog("https://shop.example/cart?key=secret")).includes("key="), false)
})

test("browser unsubscribe posts render HTML and one-click stays JSON", () => {
  assert.equal(
    unsubscribePostFormat({ body: "", accept: "text/html,application/xhtml+xml" }),
    "html"
  )
  assert.equal(
    unsubscribePostFormat({ body: "List-Unsubscribe=One-Click", accept: "*/*" }),
    "json"
  )
  assert.equal(
    unsubscribePostFormat({ body: "", accept: "application/json" }),
    "json"
  )
  assert.match(UNSUBSCRIBE_CONFIRMATION, /You've been unsubscribed from cart recovery emails/)
})

test("recovery email names the store and escapes HTML", () => {
  assert.equal(recoveryStoreDisplayName("Acme", "ignored.myshopify.com"), "Acme")
  assert.equal(
    recoveryStoreDisplayName(null, "cartrenew-empty-test.myshopify.com"),
    "cartrenew-empty-test"
  )
  assert.equal(recoveryStoreDisplayName(null, "cartrenew-empty-test"), "cartrenew-empty-test")
  assert.equal(recoveryStoreDisplayName(null, null), "the store")
  assert.equal(recoveryStoreDisplayName("", ""), "the store")
  assert.equal(
    recoveryEmailSubject("Acme\r\nBcc: evil@example.com"),
    "You left something in your cart at Acme Bcc: evil@example.com"
  )
  assert.equal(recoveryEmailSubject("Acme"), "You left something in your cart at Acme")
  assert.equal(recoveryFromName(null, "Acme"), "Acme")
  assert.equal(recoveryFromName("Acme Care", "Acme"), "Acme Care")

  const rendered = renderRecoveryEmail({
    storeName: 'Acme <script>',
    brandName: "Pingza",
    items: [],
    checkoutUrl: "https://shop.example/checkout",
    unsubscribeUrl: "https://app.example/unsubscribe/token",
    postalAddress: "1 Market Street",
  })
  assert.match(rendered.html, /You left something in your cart at Acme &lt;script&gt;/)
  assert.match(rendered.html, /Sent on behalf of Acme &lt;script&gt; via Pingza/)
  assert.equal(rendered.html.includes("<script>"), false)
  const injected = renderRecoveryEmail({
    storeName: "Acme\r\n<script>",
    brandName: "Pingza",
    items: [],
    checkoutUrl: "https://shop.example/checkout",
    unsubscribeUrl: "https://app.example/unsubscribe/token",
    postalAddress: "1 Market Street",
  })
  assert.equal(injected.html.includes("\r"), false)
  assert.equal(injected.html.includes("\n<script>"), false)
  assert.match(injected.html, /Acme &lt;script&gt;/)
  assert.match(rendered.text, /Sent on behalf of Acme <script> via Pingza/)
})

test("permanent email skips are distinct from temporary config misses", () => {
  assert.equal(permanentEmailSkipError("no_consent"), "no_email_consent")
  assert.equal(permanentEmailSkipError("suppressed"), "email_suppressed")
  assert.equal(permanentEmailSkipError("invalid_email"), "invalid_email")
  for (const temporary of [
    "disabled",
    "allowlist",
    "allowlist_empty",
    "missing_sender",
    "missing_unsubscribe_secret",
    "missing_app_url",
    "missing_checkout",
    "missing_postal",
    "default_brand",
    "woocommerce",
  ]) {
    assert.equal(permanentEmailSkipError(temporary), null, temporary)
  }
})
