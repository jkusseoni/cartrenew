import { NextResponse } from "next/server"

import { brand } from "@/lib/brand"
import { suppressionInsert } from "@/lib/email/suppression"
import { readUnsubscribeToken } from "@/lib/email/unsubscribe-token"
import {
  UNSUBSCRIBE_CONFIRMATION,
  unsubscribePostFormat,
} from "@/lib/email/unsubscribe-format"
import { supabaseAdmin } from "@/lib/supabase"
import { redactSecrets } from "@/lib/services/redact-secrets"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function page(title: string, body: string, status = 200): NextResponse {
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;max-width:520px;margin:40px auto;padding:0 16px;">
<h1>${title}</h1><p>${body}</p></body></html>`
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

async function suppress(email: string): Promise<void> {
  const write = suppressionInsert(email, "unsubscribed")
  if (!write) return
  const { error } = await supabaseAdmin.from("email_suppressions").upsert(write.row, write.options)
  if (error) console.error("Unsubscribe insert failed:", redactSecrets(error.message))
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  if (brand.isDefault) return page("Not found", "This page is not available.")
  const { token } = await context.params
  const secret = (process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "").trim()
  const parsed = readUnsubscribeToken(decodeURIComponent(token), secret)
  if (!parsed.ok) {
    return page("Invalid link", "This unsubscribe link is invalid.", 400)
  }
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;max-width:520px;margin:40px auto;padding:0 16px;">
<h1>Unsubscribe</h1>
<p>Stop cart recovery emails to ${parsed.email.replace(/[&<>"]/g, "")}.</p>
<form method="post"><button type="submit">Unsubscribe</button></form>
</body></html>`
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  if (brand.isDefault) return NextResponse.json({ ok: false }, { status: 404 })
  const body = await request.text()
  const format = unsubscribePostFormat({
    body,
    accept: request.headers.get("accept"),
  })
  const { token } = await context.params
  const secret = (process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "").trim()
  const parsed = readUnsubscribeToken(decodeURIComponent(token), secret)
  if (!parsed.ok) {
    return page("Invalid link", "This unsubscribe link is invalid.", 400)
  }
  await suppress(parsed.email)
  if (format === "json") return NextResponse.json({ ok: true })
  return page("Unsubscribed", UNSUBSCRIBE_CONFIRMATION)
}
