import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const locales = ['en', 'hi', 'es', 'pt', 'de'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
  // 'always' makes the default-locale prefix explicit (e.g. /en/sign-in),
  // so Clerk's hardcoded path="/en/..." props line up with the real URLs
  // and next-intl no longer strips/redirects the prefix.
  localePrefix: 'always',
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);