"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale } from "next-intl";

export type Currency = "USD" | "INR" | "EUR" | "GBP" | "AED";

type MarketSettingsContextValue = {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
};

const currencyStorageKey = "cartrenew-currency";

const localeCurrencyDefaults: Record<string, Currency> = {
  en: "USD",
  hi: "INR",
};

const MarketSettingsContext = createContext<MarketSettingsContextValue | null>(null);

export function MarketSettingsProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const defaultCurrency = localeCurrencyDefaults[locale] ?? "USD";
  const [currency, setCurrencyState] = useState<Currency>(defaultCurrency);

  useEffect(() => {
    const savedCurrency = window.localStorage.getItem(currencyStorageKey);

    if (savedCurrency === "USD" || savedCurrency === "INR") {
      setCurrencyState(savedCurrency);
    }
  }, []);

  const value = useMemo<MarketSettingsContextValue>(
    () => ({
      currency,
      setCurrency: (nextCurrency) => {
        setCurrencyState(nextCurrency);
        window.localStorage.setItem(currencyStorageKey, nextCurrency);
      },
    }),
    [currency]
  );

  return <MarketSettingsContext.Provider value={value}>{children}</MarketSettingsContext.Provider>;
}

export function useMarketSettings() {
  const context = useContext(MarketSettingsContext);

  if (!context) {
    throw new Error("useMarketSettings must be used inside MarketSettingsProvider");
  }

  return context;
}
