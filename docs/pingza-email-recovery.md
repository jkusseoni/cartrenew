# Pingza recovery email

Pingza sends at most one abandoned-cart email when WhatsApp cannot run.

Send rules:

- The checkout has no sendable phone.
- `buyer_accepts_marketing` was true on the Shopify checkout webhook.
- The address is not in `email_suppressions`.
- The deployment is not CartRenew.
- `EMAIL_RECOVERY_ENABLED=true` and `EMAIL_RECOVERY_ALLOWLIST` is set. An empty allowlist sends nothing. `*` sends to every consented address.

The first email uses the same 60-minute inactivity schedule as WhatsApp. A phone that WhatsApp rejects is not retried by email.

## Shopify native emails

Disable Shopify's own abandoned checkout notification before enabling this. In Shopify admin open Settings, then Notifications, then Customer notifications, and turn off Abandoned checkout. Otherwise the shopper can receive two emails for one cart.

Apply `pingza-email-migration.sql` on the Pingza database first. Do not run it on CartRenew.
