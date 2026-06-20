"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Locale = "en" | "hi" | "es" | "fr" | "de" | "ar" | "zh" | "ja" | "pt" | "ru" | "bn" | "ur" | "ta" | "te" | "mr" | "gu" | "kn" | "ml" | "pa" | "or";

const localeNames: Record<Locale, string> = {
  en: "English", hi: "हिन्दी", es: "Español", fr: "Français", de: "Deutsch",
  ar: "العربية", zh: "中文", ja: "日本語", pt: "Português", ru: "Русский",
  bn: "বাংলা", ur: "اردو", ta: "தமிழ்", te: "తెలుగు", mr: "मराठी",
  gu: "ગુજરાતી", kn: "ಕನ್ನಡ", ml: "മലയാളം", pa: "ਪੰਜਾਬੀ", or: "ଓଡ଼ିଆ",
};

const localeFlags: Record<Locale, string> = {
  en: "🇺🇸", hi: "🇮🇳", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪", ar: "🇸🇦", zh: "🇨🇳",
  ja: "🇯🇵", pt: "🇧🇷", ru: "🇷🇺", bn: "🇧🇩", ur: "🇵🇰", ta: "🇮🇳", te: "🇮🇳",
  mr: "🇮🇳", gu: "🇮🇳", kn: "🇮🇳", ml: "🇮🇳", pa: "🇮🇳", or: "🇮🇳",
};

interface LanguageContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
  locales: Locale[];
  localeNames: Record<Locale, string>;
  localeFlags: Record<Locale, string>;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [messages, setMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem("cartrenew-locale") as Locale;
    if (saved && localeNames[saved]) {
      setLocaleState(saved);
    } else {
      // Auto-detect from browser
      const browserLang = navigator.language.split("-")[0] as Locale;
      if (localeNames[browserLang]) setLocaleState(browserLang);
    }
  }, []);

  useEffect(() => {
    // Dynamic import of translation file
    import(`../messages/${locale}.json`)
      .then((mod) => setMessages(flattenObject(mod.default)))
      .catch(() => {
        // Fallback to English
        import(`../../messages/en.json`).then((mod) => setMessages(flattenObject(mod.default)));
      });
  }, [locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("cartrenew-locale", l);
  };

  const t = (key: string, params?: Record<string, string>) => {
    let text = messages[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, locales: Object.keys(localeNames) as Locale[], localeNames, localeFlags }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be inside LanguageProvider");
  return ctx;
}

// Flatten nested JSON: {nav: {pricing: "..."}} → {"nav.pricing": "..."}
function flattenObject(obj: any, prefix = ""): Record<string, string> {
  return Object.keys(obj).reduce((acc: Record<string, string>, k) => {
    const pre = prefix ? `${prefix}.` : "";
    if (typeof obj[k] === "object" && obj[k] !== null) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = String(obj[k]);
    }
    return acc;
  }, {});
}
