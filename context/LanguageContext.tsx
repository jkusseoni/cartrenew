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

interface LangCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
  locales: Locale[];
  localeNames: Record<Locale, string>;
  localeFlags: Record<Locale, string>;
}

const LangContext = createContext<LangCtx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [messages, setMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem("cartrenew-locale") as Locale;
    if (saved && localeNames[saved]) setLocaleState(saved);
    else {
      const browser = navigator.language.split("-")[0] as Locale;
      if (localeNames[browser]) setLocaleState(browser);
    }
  }, []);

  useEffect(() => {
    import(`../messages/${locale}.json`)
      .then((mod) => setMessages(flatten(mod.default)))
      .catch(() => import(`../messages/en.json`).then((m) => setMessages(flatten(m.default))));
  }, [locale]);

  const setLocale = (l: Locale) => { setLocaleState(l); localStorage.setItem("cartrenew-locale", l); };
  const t = (key: string, params?: Record<string, string>) => {
    let text = messages[key] || key;
    if (params) Object.entries(params).forEach(([k, v]) => { text = text.replace(`{${k}}`, v); });
    return text;
  };

  return (
    <LangContext.Provider value={{ locale, setLocale, t, locales: Object.keys(localeNames) as Locale[], localeNames, localeFlags }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLanguage must be inside LanguageProvider");
  return ctx;
}

function flatten(obj: any, prefix = ""): Record<string, string> {
  return Object.keys(obj).reduce((acc: Record<string, string>, k) => {
    const pre = prefix ? `${prefix}.` : "";
    if (typeof obj[k] === "object" && obj[k] !== null) Object.assign(acc, flatten(obj[k], pre + k));
    else acc[pre + k] = String(obj[k]);
    return acc;
  }, {});
}