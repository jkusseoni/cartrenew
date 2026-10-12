import { redactSecrets } from "@/lib/services/redact-secrets"

export type StoreNameQueryError = {
  code?: string | null
  message?: string | null
}

export type StoreNameQueryResult = {
  data: { store_name?: unknown } | null
  error: StoreNameQueryError | null
}

/** True for a missing store_name column. Other failures stay real errors. */
export function isMissingStoreNameColumn(error: StoreNameQueryError | null | undefined): boolean {
  if (!error) return false
  const code = (error.code ?? "").toUpperCase()
  const message = error.message ?? ""
  if (code === "42703" || code === "PGRST204") return true
  return /store_name/i.test(message) && /does not exist|schema cache/i.test(message)
}

let storeNameColumnMissing = false
let missingColumnDebugLogged = false

export function resetStoreNameColumnProbeForTests() {
  storeNameColumnMissing = false
  missingColumnDebugLogged = false
}

/**
 * Read stores.store_name. A missing column is remembered for this process and
 * is not logged as an error. A real database error is logged and returns null.
 */
export async function readOptionalStoreName(
  lookup: () => Promise<StoreNameQueryResult>,
  log: { error: (...args: unknown[]) => void; debug: (...args: unknown[]) => void } = console
): Promise<string | null> {
  if (storeNameColumnMissing) return null

  const { data, error } = await lookup()
  if (!error) {
    return typeof data?.store_name === "string" ? data.store_name : null
  }
  if (isMissingStoreNameColumn(error)) {
    storeNameColumnMissing = true
    if (!missingColumnDebugLogged) {
      missingColumnDebugLogged = true
      log.debug("Email recovery store_name column is not on this database")
    }
    return null
  }

  log.error(
    "Email recovery store name lookup failed:",
    redactSecrets(error.message || error.code || "unknown")
  )
  return null
}
