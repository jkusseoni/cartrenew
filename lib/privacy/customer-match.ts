function digits(phone: string): string {
  return phone.replace(/\D/g, "")
}

/** Same last-10-digit match the Shopify checkout webhook already uses. */
export function phonesMatch(
  storedPhone: string | null | undefined,
  incomingPhone: string | null | undefined
): boolean {
  if (!storedPhone || !incomingPhone) return false
  const a = digits(storedPhone)
  const b = digits(incomingPhone)
  if (!a || !b) return false
  if (a === b) return true
  const aTail = a.slice(-10)
  const bTail = b.slice(-10)
  return aTail.length >= 10 && bTail.length >= 10 && aTail === bTail
}

export function emailsMatch(
  storedEmail: string | null | undefined,
  incomingEmail: string | null | undefined
): boolean {
  const stored = (storedEmail ?? "").trim().toLowerCase()
  const incoming = (incomingEmail ?? "").trim().toLowerCase()
  return Boolean(stored && incoming && stored === incoming)
}
