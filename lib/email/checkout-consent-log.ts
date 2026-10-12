const INTEREST = /accept|marketing|consent/i
const PII_KEY = /email|phone|address|name|token|secret|hmac|password|authorization/i

function safePrimitive(key: string, value: unknown): unknown {
  if (value == null || typeof value === "boolean" || typeof value === "number") return value
  if (typeof value !== "string") return undefined
  if (PII_KEY.test(key) || value.includes("@") || value.length > 80) return undefined
  return value
}

function summarizeObject(value: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (PII_KEY.test(key)) continue
    const primitive = safePrimitive(key, child)
    if (primitive !== undefined || child == null) {
      summary[key] = child == null ? null : primitive
      continue
    }
    if (typeof child === "object") summary[key] = Array.isArray(child) ? `array:${child.length}` : "object"
  }
  return summary
}

function walk(value: unknown, path: string, out: Record<string, unknown>, depth: number): void {
  if (depth > 6 || !value || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, out, depth + 1))
    return
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key
    if (INTEREST.test(key)) {
      if (child && typeof child === "object" && !Array.isArray(child)) {
        out[childPath] = summarizeObject(child as Record<string, unknown>)
      } else if (Array.isArray(child)) {
        out[childPath] = `array:${child.length}`
      } else {
        const primitive = safePrimitive(key, child)
        out[childPath] = primitive === undefined && typeof child === "string" ? "string" : child == null ? null : primitive ?? typeof child
      }
    }
    walk(child, childPath, out, depth + 1)
  }
}

/** Temporary checkout diagnostic. Key names and non-PII consent values only. */
export function summarizeCheckoutConsent(
  payload: unknown,
  meta: { topic: string; apiVersion: string | null }
): {
  topic: string
  apiVersion: string | null
  topLevelKeys: string[]
  consentFields: Record<string, unknown>
} {
  const record = payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {}
  const consentFields: Record<string, unknown> = {}
  walk(record, "", consentFields, 0)
  return {
    topic: meta.topic,
    apiVersion: meta.apiVersion,
    topLevelKeys: Object.keys(record).sort(),
    consentFields,
  }
}
