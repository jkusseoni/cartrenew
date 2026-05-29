import { supabaseAdmin } from './supabase'

export type AlertLevel = 'info' | 'warning' | 'error'

export async function alertEvent(level: AlertLevel, source: string, eventType: string, payload: any) {
  try {
    // write to alerts table
    await supabaseAdmin.from('alerts').insert({
      level,
      source,
      event_type: eventType,
      payload,
    })
  } catch (e) {
    // best-effort — don't crash main flow
    console.error('monitoring.alertEvent write failed', e)
  }

  const webhook = process.env.ALERT_WEBHOOK_URL
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, source, eventType, payload }),
      })
    } catch (e) {
      console.error('monitoring.alertEvent webhook failed', e)
    }
  }
}
