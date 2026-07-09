"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Locale = "en" | "hi" | "hni";

const localeNames: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  hni: "Hinglish",
};

const localeFlags: Record<Locale, string> = {
  en: "🇺🇸",
  hi: "🇮🇳",
  hni: "🇮🇳",
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
    const saved = localStorage.getItem("cartrenew-locale") as Locale;
    if (saved && localeNames[saved]) {
      setLocaleState(saved);
    }
  }, []);

  useEffect(() => {
    import(`../../messages/${locale}.json`)
      .then((mod) => setMessages(flattenObject(mod.default)))
      .catch(() => {
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
    <LanguageContext.Provider
      value={{
        locale,
        setLocale,
        t,
        locales: Object.keys(localeNames) as Locale[],
        localeNames,
        localeFlags,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be inside LanguageProvider");
  return ctx;
}

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
