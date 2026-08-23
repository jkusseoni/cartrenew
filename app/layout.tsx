import type { Metadata } from "next";
import { headers } from "next/headers";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getShopifyClientId } from "@/lib/shopify/config";
import AppProviders from "./providers";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "CartRenew — WhatsApp Cart Recovery",
  description: "AI-powered WhatsApp cart recovery for Shopify & WooCommerce",
};

/**
 * App Bridge CDN must be the first <script> in the document for Shopify's
 * embedded-app checks. Nested route layouts cannot guarantee that (Next merges
 * head after its own injections), so we put it first in this root <head> when
 * proxy.ts marks the request with x-shopify-embed=1 for /app.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const isShopifyEmbed = headerList.get("x-shopify-embed") === "1";
  const shopifyClientId = getShopifyClientId();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {isShopifyEmbed ? (
          // Raw sync CDN tag — must be the first <script> in the document.
          // Do not use next/script, async, or defer (Shopify embedded-app check).
          <script
            src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
            data-api-key={shopifyClientId}
          ></script>
        ) : null}
      </head>
      <body className={`${dmSans.variable} ${jetBrainsMono.variable} antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
