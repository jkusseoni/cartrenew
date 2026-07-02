/**
 * Shared client-side validators for form inputs.
 * Keep these dependency-free so they work in both client and server components.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// 10-15 digits, optional leading +, spaces/dashes tolerated then stripped.
const PHONE_RE = /^\+?[0-9]{10,15}$/;
const SHOPIFY_DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
const NUMERIC_ID_RE = /^[0-9]{6,20}$/;

export type FieldError = string | null;

export function validateRequired(value: string, label: string): FieldError {
  return value.trim() ? null : `${label} is required`;
}

export function validateEmail(value: string): FieldError {
  if (!value.trim()) return "Email is required";
  return EMAIL_RE.test(value.trim()) ? null : "Enter a valid email address";
}

/** Accepts "+919755612850", "919755612850", "97556 12850" etc. */
export function validatePhone(value: string): FieldError {
  if (!value.trim()) return "Phone number is required";
  const normalized = value.replace(/[\s-]/g, "");
  return PHONE_RE.test(normalized) ? null : "Enter a valid phone number (10-15 digits)";
}

export function validateShopifyDomain(value: string): FieldError {
  if (!value.trim()) return "Shopify domain is required";
  return SHOPIFY_DOMAIN_RE.test(value.trim())
    ? null
    : "Must be a *.myshopify.com domain (e.g. my-store.myshopify.com)";
}

/** WhatsApp Phone Number IDs are numeric Meta identifiers. */
export function validateNumericId(value: string, label: string): FieldError {
  if (!value.trim()) return `${label} is required`;
  return NUMERIC_ID_RE.test(value.trim()) ? null : `${label} must be a numeric ID`;
}

export function validateUrl(value: string, { optional = false }: { optional?: boolean } = {}): FieldError {
  const trimmed = value.trim();
  if (!trimmed) return optional ? null : "URL is required";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "URL must start with http:// or https://";
    }
    return null;
  } catch {
    return "Enter a valid URL";
  }
}

export function validatePositiveAmount(value: string, label: string): FieldError {
  if (!value.trim()) return `${label} is required`;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return `${label} must be a number`;
  if (parsed <= 0) return `${label} must be greater than 0`;
  return null;
}

/** Returns true when every error in the map is null. */
export function isValid(errors: Record<string, FieldError>): boolean {
  return Object.values(errors).every((error) => error === null);
}
