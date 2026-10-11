import { NextResponse } from "next/server"

import { brand } from "@/lib/brand"
import { classifyResendEvent, verifyResendWebhook } from "@/lib/email/resend"
import { suppressionInsert } from "@/lib/email/suppression"
import { supabaseAdmin } from "@/lib/supabase"
import { redactSecrets } from "@/lib/services/redact-secrets"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  if (brand.isDefault) return NextResponse.json({ ok: false }, { status: 404 })

  const payload = await request.text()
  const secret = (process.env.RESEND_WEBHOOK_SECRET ?? "").trim()
  const valid = verifyResendWebhook(
    payload,
    {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    secret
  )
  if (!valid) return NextResponse.json({ ok: false }, { status: 401 })

  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const event = classifyResendEvent(parsed)
  if (event.kind === "hard_bounce" || event.kind === "complaint") {
    const reason = event.kind === "hard_bounce" ? "bounced" : "complained"
    const write = event.email ? suppressionInsert(event.email, reason) : null
    if (write) {
      const { error } = await supabaseAdmin.from("email_suppressions").upsert(write.row, write.options)
      if (error) console.error("Resend suppression failed:", redactSecrets(error.message))
    }
  }

  if ((event.kind === "delivered" || event.kind === "opened") && event.providerId) {
    const status = event.kind === "delivered" ? "delivered" : "read"
    const { error } = await supabaseAdmin
      .from("messages")
      .update({ status })
      .eq("whatsapp_message_id", event.providerId)
      .eq("channel", "email")
      .in("status", event.kind === "opened" ? ["sent", "delivered", "queued", "pending"] : ["sent", "queued", "pending"])
    if (error) console.error("Resend status update failed:", redactSecrets(error.message))
  }

  return NextResponse.json({ ok: true })
}
