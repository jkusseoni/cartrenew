import crypto from "crypto";

export function hashData(data: string | undefined | null): string | null {
  if (!data) return null;
  return crypto
    .createHash("sha256")
    .update(data.trim().toLowerCase())
    .digest("hex");
}

export function isSha256Hash(data: string | undefined | null): data is string {
  return Boolean(data && /^[a-f0-9]{64}$/i.test(data.trim()));
}

export function hashDataUnlessAlreadyHashed(data: string | undefined | null): string | null {
  if (!data) return null;

  const trimmed = data.trim();
  if (isSha256Hash(trimmed)) {
    return trimmed.toLowerCase();
  }

  return hashData(trimmed);
}
