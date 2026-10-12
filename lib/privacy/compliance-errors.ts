export class PrivacyDbError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = "PrivacyDbError"
    this.code = code
  }
}

export class PrivacyConfigError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = "PrivacyConfigError"
    this.code = code
  }
}

/** Missing email_suppressions. PostgREST reports that as 42P01 or PGRST205. */
export function isMissingSuppressionsTable(error: unknown): boolean {
  return error instanceof PrivacyDbError && (error.code === "42P01" || error.code === "PGRST205")
}
