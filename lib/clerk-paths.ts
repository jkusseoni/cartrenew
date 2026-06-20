"use client";

/** Ensures Clerk redirect props are root-absolute URLs, not relative to the auth mount path. */
export function toAbsoluteClerkUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;

  if (typeof window === "undefined") {
    return normalized;
  }

  return `${window.location.origin}${normalized}`;
}
