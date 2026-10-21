import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  applyShopifyCheckoutMarketingConsent,
  isMissingConsentOrderingMigration,
  parseShopifyCheckoutUpdatedAt,
} from "../lib/shopify/checkout-consent-ordering"

const NOW = Date.parse("2026-10-21T11:00:00.000Z")

function fakeClient({
  rpcError = null,
  fallbackError = null,
}: {
  rpcError?: Record<string, unknown> | null
  fallbackError?: Record<string, unknown> | null
} = {}) {
  const calls: Array<{ kind: string; value: unknown }> = []
  const client = {
    async rpc(name: string, args: unknown) {
      calls.push({ kind: "rpc", value: { name, args } })
      return { data: null, error: rpcError }
    },
    from(table: string) {
      return {
        update(values: unknown) {
          calls.push({ kind: "fallback", value: { table, values } })
          return {
            eq() {
              return {
                async in() {
                  return { data: null, error: fallbackError }
                },
              }
            },
          }
        },
      }
    },
  }
  return { client: client as never, calls }
}

test("accepts only timezone-qualified, non-future checkout updated_at values", () => {
  assert.equal(
    parseShopifyCheckoutUpdatedAt("2026-10-21T10:05:00+00:00", NOW),
    "2026-10-21T10:05:00.000Z"
  )
  assert.equal(parseShopifyCheckoutUpdatedAt("2026-10-21T10:05:00", NOW), null)
  assert.equal(parseShopifyCheckoutUpdatedAt("not-a-date", NOW), null)
  assert.equal(parseShopifyCheckoutUpdatedAt(null, NOW), null)
  assert.equal(parseShopifyCheckoutUpdatedAt("2026-10-21T11:06:00Z", NOW), null)
})

test("passes both consent fields and the normalized source timestamp to one atomic RPC", async () => {
  const { client, calls } = fakeClient()
  const result = await applyShopifyCheckoutMarketingConsent(
    {
      cartId: "00000000-0000-0000-0000-000000000001",
      payloadUpdatedAt: "2026-10-21T10:05:00Z",
      smsConsent: false,
      emailConsent: true,
    },
    { client, nowMs: NOW }
  )

  assert.deepEqual(result, { mode: "atomic", eventAt: "2026-10-21T10:05:00.000Z" })
  assert.deepEqual(calls, [{
    kind: "rpc",
    value: {
      name: "apply_shopify_checkout_marketing_consent",
      args: {
        p_cart_id: "00000000-0000-0000-0000-000000000001",
        p_event_at: "2026-10-21T10:05:00.000Z",
        p_sms_consent: false,
        p_email_consent: true,
      },
    },
  }])
})

test("missing or invalid timestamps reach the RPC as null for fail-closed SQL handling", async () => {
  const { client, calls } = fakeClient()
  await applyShopifyCheckoutMarketingConsent(
    {
      cartId: "00000000-0000-0000-0000-000000000002",
      payloadUpdatedAt: "invalid",
      smsConsent: true,
      emailConsent: false,
    },
    { client, nowMs: NOW }
  )

  const rpc = calls[0]?.value as { args: Record<string, unknown> }
  assert.equal(rpc.args.p_event_at, null)
  assert.equal(rpc.args.p_sms_consent, true)
  assert.equal(rpc.args.p_email_consent, false)
})

test("code-before-migration rollout applies only revocations and ignores positive consent", async () => {
  const missing = {
    code: "PGRST202",
    message: "Could not find the function public.apply_shopify_checkout_marketing_consent in the schema cache",
  }
  assert.equal(isMissingConsentOrderingMigration(missing), true)

  const revocation = fakeClient({ rpcError: missing })
  const revoked = await applyShopifyCheckoutMarketingConsent(
    {
      cartId: "00000000-0000-0000-0000-000000000003",
      payloadUpdatedAt: "2026-10-21T10:05:00Z",
      smsConsent: false,
      emailConsent: false,
    },
    { client: revocation.client, nowMs: NOW }
  )
  assert.equal(revoked.mode, "fallback_revocation")
  const fallback = revocation.calls[1]?.value as { values: Record<string, unknown> }
  assert.deepEqual(fallback.values, {
    sms_marketing_consent: false,
    email_marketing_consent: false,
  })

  const positive = fakeClient({ rpcError: missing })
  const ignored = await applyShopifyCheckoutMarketingConsent(
    {
      cartId: "00000000-0000-0000-0000-000000000004",
      payloadUpdatedAt: "2026-10-21T10:05:00Z",
      smsConsent: true,
      emailConsent: true,
    },
    { client: positive.client, nowMs: NOW }
  )
  assert.equal(ignored.mode, "ignored_positive_without_migration")
  assert.equal(positive.calls.some((call) => call.kind === "fallback"), false)
})

test("non-schema RPC failures are retried by Shopify instead of bypassing ordering", async () => {
  const { client } = fakeClient({ rpcError: { code: "500", message: "database unavailable" } })
  await assert.rejects(
    applyShopifyCheckoutMarketingConsent(
      {
        cartId: "00000000-0000-0000-0000-000000000005",
        payloadUpdatedAt: "2026-10-21T10:05:00Z",
        smsConsent: false,
        emailConsent: false,
      },
      { client, nowMs: NOW }
    ),
    (error: unknown) =>
      Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "500")
  )
})

test("migration serializes the cart row and makes equal-timestamp false win", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "db/migrations/2026-10-21-pingza-shopify-consent-ordering.sql"),
    "utf8"
  )
  assert.match(sql, /for update/i)
  assert.match(sql, /p_event_at > current_cart\.shopify_sms_consent_updated_at/)
  assert.match(sql, /p_event_at = current_cart\.shopify_sms_consent_updated_at[\s\S]+p_sms_consent = false/)
  assert.match(sql, /p_event_at is null and p_sms_consent = false[\s\S]+v_received_at/)
  assert.match(sql, /sms_marketing_consent = case[\s\S]+shopify_sms_consent_updated_at is null then false/)
  assert.match(sql, /status in \('pending', 'messaged'\)/)
  assert.match(sql, /coalesce\([\s\S]+shopify_sms_consent_updated_at[\s\S]+migration_barrier\.received_at/)
  assert.match(sql, /create trigger trg_abandoned_carts_consent_ordering/)
  assert.match(sql, /timestamp-less positive changes are discarded/i)
  assert.match(sql, /new\.sms_marketing_consent := old\.sms_marketing_consent/)
  assert.match(sql, /revoke all on function[\s\S]+from public/i)
  assert.match(sql, /grant execute on function[\s\S]+to service_role/i)
})

test("migration and fresh Pingza schema reject unversioned positive consent on INSERT", () => {
  for (const file of [
    "db/migrations/2026-10-21-pingza-shopify-consent-ordering.sql",
    "pingza-schema.sql",
  ]) {
    const sql = fs.readFileSync(path.join(process.cwd(), file), "utf8")
    assert.match(sql, /if tg_op = 'INSERT' then/i)
    assert.match(sql, /before insert or update of[\s\S]+sms_marketing_consent/i)
    assert.match(
      sql,
      /new\.sms_marketing_consent = true[\s\S]+new\.shopify_sms_consent_updated_at is null[\s\S]+new\.sms_marketing_consent := false[\s\S]+new\.shopify_sms_consent_updated_at := v_received_at/i
    )
    assert.match(
      sql,
      /new\.email_marketing_consent = true[\s\S]+new\.shopify_email_consent_updated_at is null[\s\S]+new\.email_marketing_consent := false[\s\S]+new\.shopify_email_consent_updated_at := v_received_at/i
    )
  }
})

test("shared CartRenew migration runner excludes the Pingza-only consent migration", () => {
  const runner = fs.readFileSync(
    path.join(process.cwd(), "scripts/run-db-migrations.ts"),
    "utf8"
  )
  assert.doesNotMatch(runner, /2026-10-21-pingza-shopify-consent-ordering\.sql/)
})

test("webhook base upsert no longer writes consent outside the atomic helper", () => {
  const route = fs.readFileSync(
    path.join(process.cwd(), "app/api/webhooks/shopify/route.ts"),
    "utf8"
  )
  assert.equal((route.match(/applyShopifyCheckoutMarketingConsent\(\{/g) ?? []).length, 2)
  assert.doesNotMatch(route, /\{ email_marketing_consent: emailMarketingConsent \}/)
  assert.doesNotMatch(route, /\{ sms_marketing_consent: smsMarketingConsent \}/)
})
