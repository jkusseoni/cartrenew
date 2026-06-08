import type { Metadata } from "next";
import { Inter } from "next/font/google";
import MetaCheckoutTracker from "@/components/MetaCheckoutTracker";
import { HandshakeProvider } from "@/context/HandshakeContext"; 
import AppProviders from "./providers";
import { Suspense } from "react";
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
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} bg-neutral-950 antialiased`}>
        <AppProviders>
          <HandshakeProvider>
            <div className="flex min-h-screen flex-col bg-neutral-950">
              <div className="flex-1 bg-neutral-950">
                <Suspense fallback={null}>
                  <MetaCheckoutTracker />
                </Suspense>
                {children}
              </div>
            </div>
          </HandshakeProvider>
        </AppProviders>
      </body>
    </html>
  );
}