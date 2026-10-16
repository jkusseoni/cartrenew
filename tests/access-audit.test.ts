import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  ACCESS_AUDIT_RETENTION_MS,
  auditActionForComplianceTopic,
  buildAccessAuditRow,
  shouldRecordAccessAudit,
} from "../lib/privacy/access-audit"
import { assertPingzaPreviewNotOnProductionSupabase } from "../lib/supabase-env-guard"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

test("access audit is Pingza-only", () => {
  assert.equal(shouldRecordAccessAudit(true), false)
  assert.equal(shouldRecordAccessAudit(false), true)
})

test("audit rows never include PII field names as values", () => {
  const row = buildAccessAuditRow({
    shop: "Demo-Shop.myshopify.com",
    action: "export",
    actor: "POST /api/webhooks/customers/data_request",
    count: 3,
  })
  assert.equal(row.shop_domain, "demo-shop.myshopify.com")
  assert.equal(row.action, "export")
  assert.equal(row.record_count, 3)
  assert.equal(Object.keys(row).includes("phone"), false)
  assert.equal(Object.keys(row).includes("email"), false)
  assert.equal(JSON.stringify(row).includes("@"), false)
})

test("compliance topics map to audit actions", () => {
  assert.equal(auditActionForComplianceTopic("customers/data_request"), "export")
  assert.equal(auditActionForComplianceTopic("customers/redact"), "redact_customer")
  assert.equal(auditActionForComplianceTopic("shop/redact"), "redact_shop")
  assert.equal(auditActionForComplianceTopic("checkouts/update"), null)
})

test("audit retention window is 90 days", () => {
  assert.equal(ACCESS_AUDIT_RETENTION_MS, 90 * 24 * 60 * 60 * 1000)
})

test("Preview cannot use production Supabase host (Pingza)", () => {
  assert.equal(
    assertPingzaPreviewNotOnProductionSupabase({
      isDefaultBrand: false,
      vercelEnv: "preview",
      configuredUrl: "https://prod-ref.supabase.co",
      productionUrl: "https://prod-ref.supabase.co",
    }).ok,
    false
  )
  assert.equal(
    assertPingzaPreviewNotOnProductionSupabase({
      isDefaultBrand: false,
      vercelEnv: "preview",
      configuredUrl: "https://staging-ref.supabase.co",
      productionUrl: "https://prod-ref.supabase.co",
    }).ok,
    true
  )
  assert.equal(
    assertPingzaPreviewNotOnProductionSupabase({
      isDefaultBrand: true,
      vercelEnv: "preview",
      configuredUrl: "https://prod-ref.supabase.co",
      productionUrl: "https://prod-ref.supabase.co",
    }).ok,
    true,
    "CartRenew unchanged"
  )
  assert.equal(
    assertPingzaPreviewNotOnProductionSupabase({
      isDefaultBrand: false,
      vercelEnv: "production",
      configuredUrl: "https://prod-ref.supabase.co",
      productionUrl: "https://prod-ref.supabase.co",
    }).ok,
    true
  )
})

test("CartRenew recordAccessAudit is a no-op (no insert attempt required)", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `
        const inserts = []
        globalThis.fetch = async (input, init = {}) => {
          const url = typeof input === "string" ? input : String(input)
          if (url.includes("access_audit_logs") && (init.method || "GET").toUpperCase() === "POST") {
            inserts.push(url)
          }
          return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
        }
        const { recordAccessAudit } = await import("./lib/privacy/access-audit.ts")
        await recordAccessAudit({
          shop: "x.myshopify.com",
          action: "send",
          actor: "test",
          count: 1,
        })
        console.log("RESULT:" + JSON.stringify({ inserts: inserts.length }))
      `,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        NEXT_PUBLIC_APP_NAME: "CartRenew",
        NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: "test-key",
      },
      encoding: "utf8",
    }
  )
  assert.equal(result.status, 0, result.stderr)
  const line = result.stdout.split(/\r?\n/).find((l) => l.startsWith("RESULT:"))
  assert.ok(line)
  assert.equal(JSON.parse(line.slice(7)).inserts, 0)
})

test("Pingza recordAccessAudit logs without PII values", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `
        globalThis.fetch = async () =>
          new Response(JSON.stringify({ message: "relation missing", code: "PGRST205" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          })
        const { recordAccessAudit } = await import("./lib/privacy/access-audit.ts")
        await recordAccessAudit({
          shop: "pingza-demo.myshopify.com",
          action: "read_admin",
          actor: "GET /api/admin/messages/pending",
          count: 2,
        })
        console.log("RESULT:ok")
      `,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        NEXT_PUBLIC_APP_NAME: "Pingza",
        NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: "test-key",
      },
      encoding: "utf8",
    }
  )
  assert.equal(result.status, 0, result.stderr)
  const logs = result.stdout + result.stderr
  assert.match(logs, /\[access-audit\]/)
  assert.match(logs, /read_admin/)
  assert.equal(logs.includes("+91"), false)
  assert.equal(logs.includes("@gmail"), false)
})
