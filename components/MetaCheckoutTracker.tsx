"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackMetaCapiEvent } from "@/lib/meta-capi-client";

export default function MetaCheckoutTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const trackedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname.toLowerCase().includes("checkout")) return;

    const currentUrl = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;
    if (trackedUrlRef.current === currentUrl) return;

    trackedUrlRef.current = currentUrl;
    void trackMetaCapiEvent({
      eventName: "InitiateCheckout",
      value: parseNumber(searchParams.get("value") || searchParams.get("amount")),
      currency: searchParams.get("currency") || "INR",
      cartId: searchParams.get("cart_id") || searchParams.get("cartId") || undefined,
      checkoutUrl: typeof window === "undefined" ? undefined : window.location.href,
      items: getCheckoutItems(searchParams),
    }).catch((error) => {
      console.warn("Meta CAPI checkout page-load tracking failed:", error);
    });
  }, [pathname, searchParams]);

  return null;
}

function getCheckoutItems(searchParams: URLSearchParams) {
  const productId = searchParams.get("product_id") || searchParams.get("productId");
  if (!productId) return [];

  return [
    {
      id: productId,
      title: searchParams.get("product_name") || searchParams.get("productName") || "Checkout product",
      price: parseNumber(searchParams.get("value") || searchParams.get("amount")),
      quantity: parseNumber(searchParams.get("quantity")) || 1,
    },
  ];
}

function parseNumber(value: string | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
