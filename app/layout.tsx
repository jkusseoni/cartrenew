import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

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
  const skipClerk = process.env.NODE_ENV === 'development'
  return skipClerk ? (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  ) : (
    <ClerkProvider afterSignOutUrl="/" signInUrl="/sign-in" signUpUrl="/sign-up">
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}