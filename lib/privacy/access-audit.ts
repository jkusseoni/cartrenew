/**
 * Pingza-only access audit for protected customer data (Shopify PCD).
 * Records shop, action, timestamp, actor/route, and count — never PII values.
 * CartRenew (brand.isDefault) is a no-op.
 */

import { brand } from "@/lib/brand"
import { supabaseAdmin } from "@/lib/supabase"

const LOG = "[access-audit]"

/** How long audit rows are kept (customer data retention is separate). */
export const ACCESS_AUDIT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000

export type AccessAuditAction =
  | "read_admin"
  | "read_dashboard"
  | "export"
  | "redact_customer"
  | "redact_shop"
  | "send"
  | "retention_anonymize"

export type AccessAuditEntry = {
  shop: string | null
  action: AccessAuditAction
  /** Route or system actor, e.g. GET /api/admin/messages/pending */
  actor: string
  count: number
}

export type AccessAuditRow = {
  shop_domain: string | null
  action: AccessAuditAction
  actor: string
  record_count: number
  created_at: string
}

const MISSING_TABLE = new Set(["42P01", "PGRST205"])

export function shouldRecordAccessAudit(isDefaultBrand = brand.isDefault): boolean {
  return !isDefaultBrand
}

export function buildAccessAuditRow(entry: AccessAuditEntry, now = new Date()): AccessAuditRow {
  return {
    shop_domain: entry.shop?.trim().toLowerCase() || null,
    action: entry.action,
    actor: entry.actor.slice(0, 200),
    record_count: Math.max(0, Math.floor(entry.count)),
    created_at: now.toISOString(),
  }
}

/**
 * Persist a PII-free access event. Always emits a structured console line.
 * Inserts into access_audit_logs when the table exists; never throws.
 */
export async function recordAccessAudit(entry: AccessAuditEntry): Promise<void> {
  if (!shouldRecordAccessAudit()) return

  const row = buildAccessAuditRow(entry)
  console.info(LOG, {
    shop: row.shop_domain,
    action: row.action,
    actor: row.actor,
    count: row.record_count,
    at: row.created_at,
  })

  try {
    const { error } = await supabaseAdmin.from("access_audit_logs").insert({
      shop_domain: row.shop_domain,
      action: row.action,
      actor: row.actor,
      record_count: row.record_count,
      created_at: row.created_at,
    })
    if (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code ?? "")
          : ""
      if (MISSING_TABLE.has(code)) {
        console.warn(LOG, "table_missing — console-only until migration is applied")
        return
      }
      console.warn(LOG, "insert_failed", { code: code || "unknown" })
    }
  } catch {
    console.warn(LOG, "insert_failed", { code: "exception" })
  }
}

/** Map Shopify compliance topics to audit actions. */
export function auditActionForComplianceTopic(
  topic: string
): AccessAuditAction | null {
  if (topic.endsWith("customers/data_request")) return "export"
  if (topic.endsWith("customers/redact")) return "redact_customer"
  if (topic.endsWith("shop/redact")) return "redact_shop"
  return null
}

/**
 * Delete audit rows older than ACCESS_AUDIT_RETENTION_MS.
 * Pingza only. Dry-run when RETENTION_DRY_RUN is not exactly "false".
 */
export async function purgeExpiredAccessAuditLogs(options: {
  now?: number
  dryRun?: boolean
}): Promise<{ deleted: number; dryRun: boolean }> {
  if (!shouldRecordAccessAudit()) return { deleted: 0, dryRun: true }

  const now = options.now ?? Date.now()
  const dryRun =
    options.dryRun ??
    (process.env.RETENTION_DRY_RUN !== "false")
  const cutoff = new Date(now - ACCESS_AUDIT_RETENTION_MS).toISOString()

  if (dryRun) {
    const { count, error } = await supabaseAdmin
      .from("access_audit_logs")
      .select("id", { count: "exact", head: true })
      .lt("created_at", cutoff)
    if (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code ?? "")
          : ""
      if (MISSING_TABLE.has(code)) return { deleted: 0, dryRun: true }
      console.warn(LOG, "purge_count_failed", { code: code || "unknown" })
      return { deleted: 0, dryRun: true }
    }
    return { deleted: count ?? 0, dryRun: true }
  }

  const { data, error } = await supabaseAdmin
    .from("access_audit_logs")
    .delete()
    .lt("created_at", cutoff)
    .select("id")
  if (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code ?? "")
        : ""
    if (MISSING_TABLE.has(code)) return { deleted: 0, dryRun: false }
    console.warn(LOG, "purge_failed", { code: code || "unknown" })
    return { deleted: 0, dryRun: false }
  }
  return { deleted: Array.isArray(data) ? data.length : 0, dryRun: false }
}
