"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, locales, type Locale } from "@/i18n/routing";
import { useLocale } from "next-intl";
import { Globe, ChevronDown, Check } from "lucide-react";

const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  hni: "Hinglish",
};

const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇺🇸",
  hi: "🇮🇳",
  hni: "🇮🇳",
};

export default function LanguageSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const currentLocale = useLocale() as Locale;
  const ref = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLanguageChange = (newLocale: Locale) => {
    setIsOpen(false);
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="relative z-50" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-all shadow-sm"
      >
        <Globe size={14} className="text-slate-500" />
        <span className="hidden sm:inline">
          {LOCALE_FLAGS[currentLocale] || "🌐"} {LOCALE_NAMES[currentLocale] || currentLocale}
        </span>
        <span className="sm:hidden">{LOCALE_FLAGS[currentLocale] || "🌐"}</span>
        <ChevronDown size={12} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl overflow-hidden z-50 border border-slate-200 shadow-xl">
            <div className="max-h-72 overflow-y-auto py-1">
              {locales.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleLanguageChange(code)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-colors text-left ${
                    currentLocale === code
                      ? "text-blue-600 bg-blue-50"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-sm">{LOCALE_FLAGS[code]}</span>
                    <span>{LOCALE_NAMES[code]}</span>
                  </span>
                  {currentLocale === code && <Check size={14} className="text-blue-500" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
