import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AppProviders from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CartRenew - AI WhatsApp Cart Recovery",
  description: "Recover abandoned carts with AI-powered WhatsApp messages",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const skipClerk =
    process.env.NODE_ENV === 'development' ||
    process.env.SKIP_CLERK === 'true' ||
    process.env.NEXT_PUBLIC_SKIP_CLERK === 'true'

  if (skipClerk) {
    return (
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    )
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
