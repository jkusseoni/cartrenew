import { brand } from "@/lib/brand";

/** Shown only on non-default brands. CartRenew does not send recovery email. */
export default function EmailRecoveryNotice() {
  if (brand.isDefault) return null;

  return (
    <div className="mb-8 rounded-2xl border border-amber-900/60 bg-amber-950/30 p-4 text-sm text-amber-100">
      <p className="font-black">Turn off Shopify&apos;s own abandoned checkout email</p>
      <p className="mt-1 text-amber-100/80">
        {brand.name}{" "}sends one recovery email when a checkout has no WhatsApp number.
        In Shopify admin go to Settings → Checkout → Abandoned checkout emails and
        turn that notification off. If Shopify Messaging&apos;s abandoned-checkout
        automation is active, turn it off too so the shopper does not get a second email.
      </p>
    </div>
  );
}
