import { supabaseAdmin } from './supabase'

export type AlertLevel = 'info' | 'warning' | 'error'

export async function alertEvent(level: AlertLevel, source: string, eventType: string, payload: any) {
  try {
    // write to alerts table — Supabase returns errors instead of throwing,
    // so the result must be checked explicitly.
    const { error } = await supabaseAdmin.from('alerts').insert({
      level,
      source,
      event_type: eventType,
      payload,
    })
    if (error) {
      console.error('monitoring.alertEvent write failed', error)
    }
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
