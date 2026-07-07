import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Suspense } from "react";

import { routing } from "@/i18n/routing";
import { HandshakeProvider } from "@/context/HandshakeContext";
import { MarketSettingsProvider } from "@/context/MarketSettingsContext";
import MetaCheckoutTracker from "@/components/MetaCheckoutTracker";
import OfflineBanner from "@/components/OfflineBanner";
import PageTransitionProvider from "@/components/PageTransitionProvider"; // नया एनीमेशन प्रोवाइडर

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
          <div 
            lang={locale} 
            dir={locale === "ar" ? "rtl" : "ltr"} 
            className="relative flex min-h-screen flex-col bg-[#060913] text-slate-100 font-sans antialiased selection:bg-blue-500/30 overflow-x-hidden"
          >
            {/* ✨ ग्लोबल प्रीमियम बैकग्राउंड एम्बिएंट लाइट्स (BiteSpeed स्टाइल) */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
              <div className="absolute -top-[30%] -left-[10%] h-[600px] w-[600px] rounded-full bg-blue-600/10 blur-[120px]" />
              <div className="absolute bottom-[10%] -right-[10%] h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-[100px]" />
            </div>

            {/* मुख्य कंटेंट रैपर */}
            <div className="relative z-10 flex-1 flex flex-col">
              <Suspense fallback={null}>
                <MetaCheckoutTracker />
              </Suspense>
              
              {/* ग्लोबल नेटवर्क-ड्रॉप इंडिकेटर */}
              <OfflineBanner />
              
              {/* ✨ अंदर के सभी पेजों को एक ग्लोबल, स्मूथ ट्रांजिशन स्टाइल देना */}
              <PageTransitionProvider>
                {children}
              </PageTransitionProvider>
            </div>
          </div>
        </MarketSettingsProvider>
      </HandshakeProvider>
    </NextIntlClientProvider>
  );
}
