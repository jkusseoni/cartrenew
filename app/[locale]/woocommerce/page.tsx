import type { Metadata } from "next";

import WooCommerceLanding from "@/components/woocommerce/WooCommerceLanding";

export const metadata: Metadata = {
  title: "CartRenew for WooCommerce — WhatsApp Abandoned Cart Recovery",
  description:
    "Recover abandoned WooCommerce carts with automated WhatsApp reminders. Install the plugin, paste your credentials, and start recovering revenue in minutes.",
};

export default function WooCommerceMarketingPage() {
  return <WooCommerceLanding />;
}
