"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Check, ChevronDown, Globe } from "lucide-react";

import { locales, usePathname, useRouter, type Locale } from "@/i18n/routing";

const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  hni: "Hinglish",
};

export default function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const currentLocale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const handleLanguageChange = (nextLocale: Locale) => {
    setIsOpen(false);
    if (nextLocale === currentLocale) return;

    try {
      window.localStorage.setItem("cartrenew-locale", nextLocale);
    } catch {
      // ignore storage failures (private mode, etc.)
    }

    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <div className="relative z-50" ref={ref}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
      >
        <Globe size={14} className="text-slate-500" />
        <span>{LOCALE_NAMES[currentLocale] ?? currentLocale}</span>
        <ChevronDown
          size={12}
          className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
        >
          {locales.map((code) => (
            <button
              key={code}
              type="button"
              role="option"
              aria-selected={currentLocale === code}
              onClick={() => handleLanguageChange(code)}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-bold transition-colors ${
                currentLocale === code
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span>{LOCALE_NAMES[code]}</span>
              {currentLocale === code && <Check size={14} className="text-blue-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
