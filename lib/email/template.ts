export const RECOVERY_EMAIL_SUBJECT = "You left something in your cart"

export type RecoveryEmailItem = { title: string; quantity: number }

export function recoveryEmailHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function itemTitles(items: unknown): RecoveryEmailItem[] {
  if (!Array.isArray(items)) return []
  return items.slice(0, 8).map((item) => {
    const row = item as { title?: unknown; name?: unknown; quantity?: unknown }
    const title = String(row.title || row.name || "Item").trim() || "Item"
    const quantity = Number(row.quantity)
    return { title, quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1 }
  })
}

export function renderRecoveryEmail(input: {
  storeName: string
  items: RecoveryEmailItem[]
  checkoutUrl: string
  unsubscribeUrl: string
  postalAddress: string
}): { html: string; text: string } {
  const store = escapeHtml(input.storeName || "the store")
  const postal = escapeHtml(input.postalAddress.trim())
  const itemHtml = input.items.length
    ? `<ul>${input.items
        .map((item) => `<li>${escapeHtml(item.title)} × ${item.quantity}</li>`)
        .join("")}</ul>`
    : "<p>Your saved items are still waiting.</p>"
  const itemText = input.items.length
    ? input.items.map((item) => `- ${item.title} x ${item.quantity}`).join("\n")
    : "Your saved items are still waiting."

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:12px;padding:24px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:14px;color:#555;">${store}</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">You left something in your cart</h1>
          ${itemHtml}
          <p style="margin:24px 0;">
            <a href="${escapeHtml(input.checkoutUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;">Complete your order</a>
          </p>
          <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#666;">
            ${postal}<br>
            <a href="${escapeHtml(input.unsubscribeUrl)}">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const text = `${input.storeName || "the store"}

You left something in your cart

${itemText}

Complete your order: ${input.checkoutUrl}

${input.postalAddress.trim()}
Unsubscribe: ${input.unsubscribeUrl}`

  return { html, text }
}
