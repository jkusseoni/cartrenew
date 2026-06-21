"use client";

import { useEffect } from "react";

type ShopifyEmbedGuardProps = {
  /** True when Shopify Admin passed the `host` query param (embedded iframe). */
  embedded: boolean;
};

/**
 * Prevents App Bridge / legacy frame-busting from blocking standalone dev access.
 * When opened directly in a browser tab (no `host`), we skip iframe-only logic.
 */
export function ShopifyEmbedGuard({ embedded }: ShopifyEmbedGuardProps) {
  useEffect(() => {
    if (embedded) return;

    // Standalone tab: do not force top-level navigation or parent-frame checks.
    const w = window as Window & { shopify?: unknown };
    if (w.shopify) {
      delete w.shopify;
    }
  }, [embedded]);

  return null;
}
