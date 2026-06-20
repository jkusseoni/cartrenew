import { routing } from "@/i18n/routing";

export const LANDING_PATH = `/${routing.defaultLocale}`;

export function localizedAuthPath(locale: string, segment: "sign-in" | "sign-up" | "dashboard") {
  // localePrefix is 'always', so every locale (including the default) is prefixed.
  return `/${locale}/${segment}`;
}
