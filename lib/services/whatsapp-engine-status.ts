import { hasTwilioWhatsAppCredentials } from '@/lib/services/twilio-whatsapp'
import { hasWhatsAppCredentials } from '@/lib/services/whatsapp-meta'

export type WhatsAppEngineStatus = {
  ok: boolean
  bypass: boolean
  label: string
}

/**
 * CartRenew still reports Twilio as Bypass Mode / Active Mode.
 * A non-default brand reports whether the Meta Cloud API credentials
 * used by whatsapp-meta.ts are configured. The result is presence only.
 */
export function whatsAppEngineStatus(isDefaultBrand: boolean): WhatsAppEngineStatus {
  if (!isDefaultBrand) {
    const configured = hasWhatsAppCredentials()
    return {
      ok: configured,
      bypass: !configured,
      label: configured ? 'Connected' : 'Not connected',
    }
  }

  const bypass = !hasTwilioWhatsAppCredentials()
  return {
    ok: true,
    bypass,
    label: bypass ? 'Bypass Mode' : 'Active Mode',
  }
}
