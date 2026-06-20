import { getRequestConfig } from 'next-intl/server';

const locales = [
  'en',
  'hi',
  'es',
  'pt',
  'de',
];

export default getRequestConfig(async ({ locale }) => {
  // Validate locale
  const validLocale = (locale && locales.includes(locale)) ? locale : 'en';

  // Load translations from ROOT messages/ folder
  const messages = (await import(`../../messages/${validLocale}.json`)).default;

  return {
    locale: validLocale,
    messages,
  };
});