/**
 * Temporary Twilio WhatsApp gateway smoke test.
 *
 * Usage:
 *   npx tsx test-twilio.ts
 *
 * Loads .env then .env.local (local overrides) and sends a mock checkout
 * recovery message to the whitelisted sandbox number.
 */
import { config } from 'dotenv'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const TEST_TO = '+919893522119'
const MOCK_CART_ID = '00000000-0000-4000-8000-testtwilio01'

async function main() {
  const {
    buildRecoveryWhatsAppBody,
    formatWhatsAppAddress,
    getTwilioWhatsAppFrom,
    hasTwilioWhatsAppCredentials,
    sendTwilioWhatsAppMessage,
  } = await import('./lib/services/twilio-whatsapp')
  const { getTrackedRecoveryUrl } = await import('./lib/recovery-link')

  if (!hasTwilioWhatsAppCredentials()) {
    console.error('❌ Twilio credentials missing or still placeholders in .env / .env.local')
    console.error('   Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER')
    process.exit(1)
  }

  const recoveryLink = getTrackedRecoveryUrl(MOCK_CART_ID)
  const body = buildRecoveryWhatsAppBody({
    customerName: 'CartRenew Test',
    cartValue: 24.95,
    currency: 'USD',
    recoveryLink,
    items: [{ title: 'Selling Plans Ski Wax', quantity: 1 }],
  })

  console.log('📤 Sending Twilio WhatsApp recovery test…')
  console.log('   From:', getTwilioWhatsAppFrom())
  console.log('   To:  ', formatWhatsAppAddress(TEST_TO))
  console.log('   Link:', recoveryLink)
  console.log('---')
  console.log(body)
  console.log('---')

  const result = await sendTwilioWhatsAppMessage(TEST_TO, body)

  if (!result.success) {
    console.error('❌ Twilio send failed:', result.error)
    process.exit(1)
  }

  console.log('✅ Message accepted by Twilio')
  console.log('   SID:', result.messageSid)
}

main().catch((error) => {
  console.error('❌ test-twilio crashed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
