export const MERCHANT_DASHBOARD_PATH = "/merchant/dashboard";
export const STANDARD_DASHBOARD_PATH = "/dashboard";

export type UserRole = "merchant" | "admin" | "user";

type SessionClaims = {
  metadata?: {
    role?: string;
  };
  public_metadata?: {
    role?: string;
  };
};

/** Primary source: sessionClaims.metadata.role (Clerk JWT custom claim). */
export function getRoleFromSessionClaims(
  sessionClaims: SessionClaims | null | undefined
): string | null {
  if (!sessionClaims?.metadata?.role) {
    return sessionClaims?.public_metadata?.role ?? null;
  }

  return sessionClaims.metadata.role;
}

export function isMerchantRole(
  sessionClaims: SessionClaims | null | undefined
): boolean {
  return getRoleFromSessionClaims(sessionClaims) === "merchant";
}
