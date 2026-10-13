/** Public contact for the Pingza deployment. Not used when brand.isDefault. */
export const PINGZA_SUPPORT_EMAIL = "support@pingza.app"

export const PINGZA_OPERATOR_NAME = "Jayant Kumar Uikey"

export const PINGZA_TRADE_NAME = "JK Digital Solutions"

export const PINGZA_PLACE = "Seoni, Madhya Pradesh, India"

/** Stable English URLs (locale prefix is always on). */
export const PINGZA_PRIVACY_PATH = "/en/privacy"
export const PINGZA_TERMS_PATH = "/en/terms"

export function publicSupportEmail(isDefaultBrand: boolean, configured: string): string {
  return isDefaultBrand ? configured : PINGZA_SUPPORT_EMAIL
}
