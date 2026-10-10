/**
 * Brand shown in the UI, so one codebase can ship more than one Shopify app.
 * Each deployment sets its own NEXT_PUBLIC_* values. Unset name and tagline
 * fall back to CartRenew. The CartRenew email and site URL are used only when
 * the name is CartRenew, so a non-default brand never inherits them.
 *
 * NEXT_PUBLIC_* vars are inlined at build time — changing them needs a rebuild,
 * and they must be read with literal `process.env.NEXT_PUBLIC_…` access.
 */

export const DEFAULT_BRAND_NAME = "CartRenew";
const DEFAULT_TAGLINE = "WhatsApp Cart Recovery";
const DEFAULT_SUPPORT_EMAIL = "contact@cartrenew.com";
const DEFAULT_APP_URL = "https://www.cartrenew.com";

export type BrandConfig = {
  name: string;
  tagline: string;
  supportEmail: string;
  appUrl: string;
  appHost: string;
  title: string;
  logo: { primary: string; accent: string };
  isDefault: boolean;
};

export type BrandPlanTier = "Starter" | "Growth" | "Scale";

function clean(value: string | undefined, fallback: string): string {
  return (value ?? "").replace(/['"]/g, "").trim() || fallback;
}

/** Display domain, e.g. "https://www.cartrenew.com" -> "cartrenew.com". */
function hostOf(url: string): string {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    host = url.replace(/^https?:\/\//, "").split("/")[0] ?? url;
  }
  return host.replace(/^www\./, "");
}

function buildBrand(): BrandConfig {
  const name = clean(process.env.NEXT_PUBLIC_APP_NAME, DEFAULT_BRAND_NAME);
  const tagline = clean(process.env.NEXT_PUBLIC_APP_TAGLINE, DEFAULT_TAGLINE);
  const isDefault = name === DEFAULT_BRAND_NAME;
  const supportEmail = clean(
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
    isDefault ? DEFAULT_SUPPORT_EMAIL : ""
  );
  const appUrl = clean(
    process.env.NEXT_PUBLIC_APP_URL,
    isDefault ? DEFAULT_APP_URL : ""
  ).replace(/\/+$/, "");

  return {
    name,
    tagline,
    supportEmail,
    appUrl,
    appHost: hostOf(appUrl),
    title: `${name} — ${tagline}`,
    logo: isDefault ? { primary: "Cart", accent: "Renew" } : { primary: name, accent: "" },
    isDefault,
  };
}

export const brand: BrandConfig = buildBrand();

export function brandPlanName(tier: BrandPlanTier): string {
  return `${brand.name} ${tier}`;
}
