import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import AppProviders from "./providers";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "CartRenew — WhatsApp Cart Recovery",
  description: "AI-powered WhatsApp cart recovery for Shopify & WooCommerce",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const shopifyApiKey =
    process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ||
    process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID ||
    process.env.SHOPIFY_API_KEY ||
    "";

  return (
    <html lang="en" suppressHydrationWarning>
      {shopifyApiKey ? (
        <head>
          <meta name="shopify-api-key" content={shopifyApiKey} />
          <meta
            name="shopify-disabled-features"
            content="fetch, auto-redirect"
          />
          <Script
            src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
            strategy="beforeInteractive"
          />
        </head>
      ) : null}
      <body className={`${dmSans.variable} ${jetBrainsMono.variable} antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}