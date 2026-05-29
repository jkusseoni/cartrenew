/**
 * Messaging provider interface and Twilio/WhatsApp implementation scaffold.
 *
 * Environment placeholders (add to your .env.*):
 * TWILIO_ACCOUNT_SID=
 * TWILIO_AUTH_TOKEN=
 * TWILIO_WHATSAPP_FROM=  (E.164, without whatsapp: prefix, e.g. +1415xxxxxxx)
 *
 * The implementation below is intentionally minimal and resilient: if Twilio
 * credentials are not present the provider will return a clear error instead
 * of throwing so the queue processor can record failures safely.
 */

export type ProviderSendResult = {
  success: boolean
  providerId?: string | null
  error?: string | null
}

export type ProviderMessage = {
  id: string
  to: string
  body: string
  metadata?: Record<string, any>
}

export async function sendMessageViaTwilio(msg: ProviderMessage): Promise<ProviderSendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: 'Twilio credentials not configured' }
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const body = new URLSearchParams()
    body.append('From', `whatsapp:${fromNumber}`)
    body.append('To', `whatsapp:${msg.to}`)
    body.append('Body', msg.body)

    const basic = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    const json = await res.json()
    if (!res.ok) {
      return { success: false, error: json.message || JSON.stringify(json) }
    }

    return { success: true, providerId: json.sid }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) }
  }
}

// Top-level provider function. If you add multiple providers (e.g., Meta Cloud API)
// detect them via env flags and route accordingly here.
export async function sendMessage(msg: ProviderMessage): Promise<ProviderSendResult> {
  // For now, always try Twilio. Add provider selection logic here later.
  return sendMessageViaTwilio(msg)
}
