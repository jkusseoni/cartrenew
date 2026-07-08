import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Suspense } from "react";

import { routing } from "@/i18n/routing";
import { HandshakeProvider } from "@/context/HandshakeContext";
import { MarketSettingsProvider } from "@/context/MarketSettingsContext";
import MetaCheckoutTracker from "@/components/MetaCheckoutTracker";
import OfflineBanner from "@/components/OfflineBanner";
import PageTransitionProvider from "@/components/PageTransitionProvider"; // नया एनीमेशन प्रोवाइडर
import Navbar from "@/components/Navbar"; // 🌟 नेवबार को यहाँ इंपोर्ट किया

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
            // 🌸 डार्क कलर्स (bg-[#060913]) हटाकर साफ़ सुथरा लाइट बैकग्राउंड (bg-[#F8FAFC]) कर दिया
            className="relative flex min-h-screen flex-col bg-[#F8FAFC] text-slate-800 font-sans antialiased selection:bg-blue-500/10 overflow-x-hidden"
          >
            {/* ✨ ग्लोबल प्रीमियम लाइट-थीम एम्बिएंट लाइट्स (सॉफ़्ट पिंक और कोमल ब्लू वाइब्स) */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
              <div className="absolute -top-[10%] -left-[10%] h-[700px] w-[700px] rounded-full bg-blue-100/40 blur-[130px] mix-blend-multiply" />
              <div className="absolute top-[40%] -right-[20%] h-[600px] w-[600px] rounded-full bg-pink-100/30 blur-[140px] mix-blend-multiply" />
              <div className="absolute bottom-[-10%] left-[20%] h-[500px] w-[500px] rounded-full bg-emerald-50/40 blur-[120px] mix-blend-multiply" />
            </div>

            {/* 🌟 नेवबार को पूरे ऐप के ऊपर रेंडर किया ताकि यह हर पेज पर दिखे */}
            <Navbar />

            {/* मुख्य कंटेंट रैपर - पैडिंग टॉप (pt-16) दी ताकि कंटेंट नेवबार के पीछे न छुपे */}
            <div className="relative z-10 flex-1 flex flex-col pt-16">
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