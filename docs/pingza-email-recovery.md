# Pingza recovery email

Pingza sends at most one abandoned-cart email when WhatsApp cannot run.

Send rules:

- WhatsApp cannot be used: the checkout has no sendable phone, or `buyer_accepts_sms_marketing` was not true on the Shopify checkout webhook.
- `buyer_accepts_marketing` was true on the Shopify checkout webhook.
- The address is not in `email_suppressions`.
- The deployment is not CartRenew.
- `EMAIL_RECOVERY_ENABLED=true` and `EMAIL_RECOVERY_ALLOWLIST` is set. An empty allowlist sends nothing. `*` sends to every consented address.

The first email uses the same 60-minute inactivity schedule as WhatsApp. A phone that WhatsApp rejects is not retried by email. A cart with neither SMS nor email marketing consent gets no message and is marked `skipped` with `last_send_error = no_marketing_consent`.

Apply `db/migrations/2026-10-17-pingza-sms-marketing-consent.sql` before deploying the WhatsApp opt-in code.

## Shopify native emails

Disable Shopify's own abandoned checkout notification before enabling this. In Shopify admin open Settings → Checkout → Abandoned checkout emails and turn it off. If Shopify Messaging's abandoned-checkout automation is active, turn that off too. Otherwise the shopper can receive two emails for one cart.

Apply `pingza-email-migration.sql` on the Pingza database first. Do not run it on CartRenew.
