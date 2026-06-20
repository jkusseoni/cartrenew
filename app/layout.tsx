import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import AppProviders from "./providers";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "CartRenew — WhatsApp Cart Recovery",
  description: "AI-powered WhatsApp cart recovery for Shopify & WooCommerce",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${jetBrainsMono.variable} antialiased`}>
        <LanguageProvider>
          <AppProviders>{children}</AppProviders>
        </LanguageProvider>
      </body>
    </html>
  );
}