export const UNSUBSCRIBE_CONFIRMATION =
  "You've been unsubscribed from cart recovery emails. You won't receive more from this store's cart reminders."

/**
 * List-Unsubscribe one-click stays JSON. A browser form POST (Accept: text/html,
 * empty body) gets an HTML page.
 */
export function unsubscribePostFormat(input: {
  body: string
  accept: string | null
}): "json" | "html" {
  if (input.body.includes("List-Unsubscribe=One-Click")) return "json"
  const accept = (input.accept ?? "").toLowerCase()
  if (accept.includes("application/json") && !accept.includes("text/html")) return "json"
  return "html"
}
