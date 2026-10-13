import type { Metadata } from "next";
import { notFound } from "next/navigation";

import WooCommerceLanding from "@/components/woocommerce/WooCommerceLanding";
import { brand } from "@/lib/brand";
import { legacyCommerceRouteEnabled } from "@/lib/privacy/legacy-commerce";

export const metadata: Metadata = {
  title: "CartRenew for WooCommerce — WhatsApp Abandoned Cart Recovery",
  description:
    "Recover abandoned WooCommerce carts with automated WhatsApp reminders. Install the plugin, paste your credentials, and start recovering revenue in minutes.",
};

export default function WooCommerceMarketingPage() {
  if (!legacyCommerceRouteEnabled(brand.isDefault)) notFound();
  return <WooCommerceLanding />;
}
