import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Suspense } from "react";

import { routing } from "@/i18n/routing";
import { HandshakeProvider } from "@/context/HandshakeContext";
import { MarketSettingsProvider } from "@/context/MarketSettingsContext";
import MetaCheckoutTracker from "@/components/MetaCheckoutTracker";
import OfflineBanner from "@/components/OfflineBanner";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <HandshakeProvider>
        <MarketSettingsProvider>
          <div lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className="flex min-h-screen flex-col bg-[#0B0F17]">
            <div className="flex-1 bg-[#0B0F17]">
              <Suspense fallback={null}>
                <MetaCheckoutTracker />
              </Suspense>
              {/* Global network-drop indicator (Phase 1 resilience) */}
              <OfflineBanner />
              {children}
            </div>
          </div>
        </MarketSettingsProvider>
      </HandshakeProvider>
    </NextIntlClientProvider>
  );
}
