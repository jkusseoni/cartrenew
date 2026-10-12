import { PrivacyConfigError } from "@/lib/privacy/compliance-errors"

export type PrivacyExportMail = {
  requestId: string
  body: string
  recipient: string
  from: string
  apiKey: string
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** One Resend email. The subject is the request id. Failures throw so Shopify retries. */
export async function deliverPrivacyExportEmail(
  input: PrivacyExportMail,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.recipient],
      subject: input.requestId,
      text: input.body,
      html: `<pre>${escapeHtml(input.body)}</pre>`,
    }),
  })
  if (!response.ok) throw new PrivacyConfigError("export_delivery_failed")
  await response.text().catch(() => "")
}

export function privacyExportRecipient(isDefaultBrand: boolean, supportEmail: string): string | null {
  if (!isDefaultBrand) return "support@pingza.app"
  const trimmed = supportEmail.trim()
  return trimmed || null
}
