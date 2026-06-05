import type { Metadata } from "next";
import { Inter } from "next/font/google";
import MetaCheckoutTracker from "@/components/MetaCheckoutTracker";
import { HandshakeProvider } from "@/context/HandshakeContext";
import AppProviders from "./providers";
import { Suspense } from "react";
import "./globals.css";
import Footer from "@/components/Footer";

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
    process.env.NODE_ENV === "development" ||
    process.env.SKIP_CLERK === "true" ||
    process.env.NEXT_PUBLIC_SKIP_CLERK === "true";

  if (skipClerk) {
    return (
      <html lang="en">
        <body className={`${inter.className} bg-neutral-950`}>
          <AppProviders>
            <HandshakeProvider>
              <div className="flex min-h-screen flex-col bg-neutral-950">
                <div className="flex-1 bg-neutral-950">
                  <Suspense fallback={null}>
                    <MetaCheckoutTracker />
                  </Suspense>
                  {children}
                </div>
                <Footer />
              </div>
            </HandshakeProvider>
          </AppProviders>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className={`${inter.className} bg-neutral-950`}>
        <AppProviders>
          <HandshakeProvider>
            <div className="flex min-h-screen flex-col bg-neutral-950">
              <div className="flex-1 bg-neutral-950">
                <Suspense fallback={null}>
                  <MetaCheckoutTracker />
                </Suspense>
                {children}
              </div>
              <Footer />
            </div>
          </HandshakeProvider>
        </AppProviders>
      </body>
    </html>
  );
}
