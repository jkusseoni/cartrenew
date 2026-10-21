/**
 * Pingza Preview/staging must not share the production Supabase project
 * (Shopify PCD: keep test and production data separate).
 * CartRenew (isDefaultBrand) never runs this guard.
 */

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
 * Block when a non-default brand runs on Vercel preview/development without a
 * canonical production host or with that host configured. Production and
 * unset VERCEL_ENV (local) pass.
 */
export function assertPingzaPreviewNotOnProductionSupabase(
  input: SupabaseEnvGuardInput
): SupabaseEnvGuardResult {
  if (input.isDefaultBrand) {
    return { ok: true, skipped: "default_brand" }
  }

  const env = (input.vercelEnv ?? "").trim().toLowerCase()
  if (env === "production") {
    return { ok: true, skipped: "production" }
  }
  if (env !== "preview" && env !== "development") {
    return { ok: true, skipped: "not_preview" }
  }

  const productionHost = normalizeHost(input.productionUrl ?? "")
  if (!productionHost) {
    return {
      ok: false,
      reason:
        `Pingza ${env} deployment cannot verify Supabase environment isolation because ` +
        `PINGZA_PRODUCTION_SUPABASE_URL is missing.`,
    }
  }

  const configuredHost = normalizeHost(input.configuredUrl)
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

  return { ok: true }
}
