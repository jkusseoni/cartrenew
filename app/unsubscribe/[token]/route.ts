import { NextResponse } from "next/server"

import { readUnsubscribeToken } from "@/lib/email/unsubscribe-token"
import { supabaseAdmin } from "@/lib/supabase"
import { redactSecrets } from "@/lib/services/redact-secrets"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function page(title: string, body: string): NextResponse {
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;max-width:520px;margin:40px auto;padding:0 16px;">
<h1>${title}</h1><p>${body}</p></body></html>`
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
}

async function suppress(email: string): Promise<void> {
  const { error } = await supabaseAdmin.from("email_suppressions").upsert(
    { email, reason: "unsubscribed", store_id: null },
    { onConflict: "email" }
  )
  if (error) console.error("Unsubscribe insert failed:", redactSecrets(error.message))
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params
  const secret = (process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "").trim()
  const parsed = readUnsubscribeToken(decodeURIComponent(token), secret)
  if (!parsed.ok) {
    return page("Link expired", "This unsubscribe link is invalid or has expired.")
  }
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;max-width:520px;margin:40px auto;padding:0 16px;">
<h1>Unsubscribe</h1>
<p>Stop cart recovery emails to ${parsed.email.replace(/[&<>"]/g, "")}.</p>
<form method="post"><button type="submit">Unsubscribe</button></form>
</body></html>`
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params
  const secret = (process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "").trim()
  const parsed = readUnsubscribeToken(decodeURIComponent(token), secret)
  if (!parsed.ok) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  await suppress(parsed.email)
  return NextResponse.json({ ok: true })
}
