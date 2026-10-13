import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { brand } from "../lib/brand"
import { legacyCommerceRouteEnabled } from "../lib/privacy/legacy-commerce"

test("Pingza does not open WooCommerce or COD routes", () => {
  assert.equal(legacyCommerceRouteEnabled(false), false)
})

test("CartRenew still reaches the WooCommerce and COD routes", async () => {
  assert.equal(legacyCommerceRouteEnabled(true), true)
  assert.equal(brand.isDefault, true)

  const abandoned = await import("../app/api/woocommerce/abandoned-cart/route")
  const register = await import("../app/api/woocommerce/register-store/route")
  const orders = await import("../app/api/orders/webhook/route")

  const abandonedResponse = await abandoned.POST(
    new NextRequest("http://localhost/api/woocommerce/abandoned-cart", { method: "POST" })
  )
  const registerResponse = await register.POST(
    new NextRequest("http://localhost/api/woocommerce/register-store", {
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json" },
    })
  )
  const orderResponse = await orders.POST(
    new Request("http://localhost/api/orders/webhook", {
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json" },
    })
  )

  assert.equal(abandonedResponse.status, 401)
  assert.equal(registerResponse.status, 400)
  assert.notEqual(orderResponse.status, 404)
})
