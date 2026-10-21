/**
 * Pingza Preview/staging must not share the production Supabase project
 * (Shopify PCD: keep test and production data separate).
 * CartRenew (isDefaultBrand) never runs this guard.
 */

import { appendFileSync } from "node:fs"

export type SupabaseEnvGuardInput = {
  isDefaultBrand: boolean
  /** Vercel: "production" | "preview" | "development" */
  vercelEnv: string | undefined
  configuredUrl: string
  /** Canonical production project URL, e.g. https://xxxx.supabase.co */
  productionUrl: string | undefined
}

export type SupabaseEnvGuardResult =
  | { ok: true; skipped?: string }
  | { ok: false; reason: string }

function normalizeHost(url: string): string {
  const cleaned = url.replace(/['"]/g, "").trim()
  if (!cleaned) return ""
  try {
    return new URL(cleaned).hostname.toLowerCase()
  } catch {
    return ""
  }
}

/**
 * Block when a non-default brand runs on Vercel preview/development with the
 * production Supabase hostname. Production and unset VERCEL_ENV (local) pass.
 */
export function assertPingzaPreviewNotOnProductionSupabase(
  input: SupabaseEnvGuardInput
): SupabaseEnvGuardResult {
  const observedEnv = (input.vercelEnv ?? "").trim().toLowerCase()
  // #region agent log
  if (process.env.CURSOR_DEBUG_SUPABASE_GUARD === "1") appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "A,C,D", location: "lib/supabase-env-guard.ts:39", message: "guard entry", data: { isDefaultBrand: input.isDefaultBrand, env: ["production", "preview", "development"].includes(observedEnv) ? observedEnv : "other", configuredUrlPresent: Boolean(input.configuredUrl.trim()), productionUrlPresent: Boolean(input.productionUrl?.trim()) }, timestamp: Date.now() }) + "\n")
  // #endregion
  if (input.isDefaultBrand) {
    return { ok: true, skipped: "default_brand" }
  }

  const env = observedEnv
  // #region agent log
  if (process.env.CURSOR_DEBUG_SUPABASE_GUARD === "1") appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "C", location: "lib/supabase-env-guard.ts:48", message: "environment gate", data: { env, entersPreviewGuard: env === "preview" || env === "development" }, timestamp: Date.now() }) + "\n")
  // #endregion
  if (env === "production") {
    return { ok: true, skipped: "production" }
  }
  if (env !== "preview" && env !== "development") {
    return { ok: true, skipped: "not_preview" }
  }

  const productionHost = normalizeHost(input.productionUrl ?? "")
  if (!productionHost) {
    // #region agent log
    if (process.env.CURSOR_DEBUG_SUPABASE_GUARD === "1") appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "A", location: "lib/supabase-env-guard.ts:61", message: "missing production host branch", data: { returnsOk: true, skipped: "production_url_unset" }, timestamp: Date.now() }) + "\n")
    // #endregion
    return {
      ok: false,
      reason:
        `Pingza ${env} deployment cannot verify Supabase environment isolation because ` +
        `PINGZA_PRODUCTION_SUPABASE_URL is missing.`,
    }
  }

  const configuredHost = normalizeHost(input.configuredUrl)
  // #region agent log
  if (process.env.CURSOR_DEBUG_SUPABASE_GUARD === "1") appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "A,D", location: "lib/supabase-env-guard.ts:72", message: "normalized host comparison", data: { configuredHostPresent: Boolean(configuredHost), productionHostPresent: Boolean(productionHost), hostsMatch: Boolean(configuredHost) && configuredHost === productionHost }, timestamp: Date.now() }) + "\n")
  // #endregion
  if (!configuredHost) {
    return { ok: true, skipped: "configured_url_empty" }
  }

  if (configuredHost === productionHost) {
    return {
      ok: false,
      reason:
        `Pingza ${env} deployment is configured with the production Supabase host ` +
        `(${productionHost}). Set NEXT_PUBLIC_SUPABASE_URL (and keys) to a non-production ` +
        `project, or unset PINGZA_PRODUCTION_SUPABASE_URL only after fixing Preview env.`,
    }
  }

  // #region agent log
  if (process.env.CURSOR_DEBUG_SUPABASE_GUARD === "1") appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "A", location: "lib/supabase-env-guard.ts:91", message: "guard success exit", data: { ok: true, comparedHosts: true }, timestamp: Date.now() }) + "\n")
  // #endregion
  return { ok: true }
}
