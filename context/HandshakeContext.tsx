"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { LifetimeDealTierKey } from "@/lib/ltd-tiers";

const TRACKING_STORAGE_KEY = "cartrenew.handshake.tracking";

const TRACKING_PARAM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "msclkid",
  "ttclid",
  "ref",
  "referral",
  "merchantId",
  "storeId",
  "cartId",
  "sessionId",
] as const;

export type TrackingParamKey = (typeof TRACKING_PARAM_KEYS)[number];
export type HandshakeTrackingParams = Partial<Record<TrackingParamKey, string>>;
export type HandshakeStatus = "idle" | "guest" | "syncing" | "synced" | "error";

type HandshakeSyncResponse = {
  activeTier: LifetimeDealTierKey | null;
  handshakeToken: string;
  merchantId: string | null;
  success: boolean;
  syncedAt: string;
  trackingParams: HandshakeTrackingParams;
};

type HandshakeContextValue = {
  activeTier: LifetimeDealTierKey | null;
  handshakeStatus: HandshakeStatus;
  handshakeToken: string | null;
  isSyncing: boolean;
  merchantId: string | null;
  setActiveTier: Dispatch<SetStateAction<LifetimeDealTierKey | null>>;
  setTrackingParam: (key: TrackingParamKey, value: string | null) => void;
  syncHandshake: () => Promise<void>;
  trackingParams: HandshakeTrackingParams;
};

const HandshakeContext = createContext<HandshakeContextValue | undefined>(undefined);

export function HandshakeProvider({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();
  const [activeTier, setActiveTier] = useState<LifetimeDealTierKey | null>(null);
  const [trackingParams, setTrackingParams] = useState<HandshakeTrackingParams>(() =>
    readInitialTrackingParams()
  );
  const [handshakeStatus, setHandshakeStatus] = useState<HandshakeStatus>("idle");
  const [isSyncing, setIsSyncing] = useState(false);
  const [handshakeToken, setHandshakeToken] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const lastSyncSignatureRef = useRef<string | null>(null);

  const setTrackingParam = useCallback((key: TrackingParamKey, value: string | null) => {
    setTrackingParams((current) => {
      const next = { ...current };
      const normalized = normalizeTrackingValue(value);

      if (normalized) {
        next[key] = normalized;
      } else {
        delete next[key];
      }

      persistTrackingParams(next);
      return next;
    });
  }, []);

  const syncHandshake = useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    if (!userId) {
      setHandshakeStatus("guest");
      return;
    }

    setHandshakeStatus("syncing");
    setIsSyncing(true);

    try {
      const response = await fetch("/api/merchant/handshake", {
        body: JSON.stringify({
          activeTier,
          clientTimestamp: new Date().toISOString(),
          email: user?.primaryEmailAddress?.emailAddress,
          firstName: user?.firstName,
          lastName: user?.lastName,
          pathname: typeof window === "undefined" ? null : window.location.pathname,
          trackingParams,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Handshake failed with status ${response.status}`);
      }

      const payload = (await response.json()) as HandshakeSyncResponse;

      setActiveTier(payload.activeTier);
      setHandshakeToken(payload.handshakeToken);
      setMerchantId(payload.merchantId);
      setTrackingParams(payload.trackingParams);
      persistTrackingParams(payload.trackingParams);
      setHandshakeStatus("synced");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown handshake error";
      console.warn("Merchant handshake sync failed:", message);
      setHandshakeStatus("error");
    } finally {
      setIsSyncing(false);
    }
  }, [activeTier, isLoaded, trackingParams, user, userId]);

  const syncSignature = useMemo(
    () =>
      JSON.stringify({
        activeTier,
        email: user?.primaryEmailAddress?.emailAddress ?? null,
        trackingParams,
        userId,
      }),
    [activeTier, trackingParams, user?.primaryEmailAddress?.emailAddress, userId]
  );

  useEffect(() => {
    if (!isLoaded || lastSyncSignatureRef.current === syncSignature) {
      return;
    }

    lastSyncSignatureRef.current = syncSignature;

    const timeoutId = window.setTimeout(() => {
      void syncHandshake();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isLoaded, syncHandshake, syncSignature]);

  const value = useMemo<HandshakeContextValue>(
    () => ({
      activeTier,
      handshakeStatus: !isLoaded ? "idle" : handshakeStatus,
      handshakeToken,
      isSyncing,
      merchantId,
      setActiveTier,
      setTrackingParam,
      syncHandshake,
      trackingParams,
    }),
    [
      activeTier,
      handshakeStatus,
      handshakeToken,
      isLoaded,
      isSyncing,
      merchantId,
      setTrackingParam,
      syncHandshake,
      trackingParams,
    ]
  );

  return <HandshakeContext.Provider value={value}>{children}</HandshakeContext.Provider>;
}

export function useHandshake() {
  const context = useContext(HandshakeContext);

  if (!context) {
    throw new Error("useHandshake must be wrapped inside HandshakeProvider");
  }

  return context;
}

function readInitialTrackingParams(): HandshakeTrackingParams {
  if (typeof window === "undefined") {
    return {};
  }

  return {
    ...readStoredTrackingParams(),
    ...readUrlTrackingParams(window.location.search),
  };
}

function readUrlTrackingParams(search: string): HandshakeTrackingParams {
  const searchParams = new URLSearchParams(search);
  const trackingParams: HandshakeTrackingParams = {};

  TRACKING_PARAM_KEYS.forEach((key) => {
    const value = normalizeTrackingValue(searchParams.get(key));

    if (value) {
      trackingParams[key] = value;
    }
  });

  persistTrackingParams(trackingParams);
  return trackingParams;
}

function readStoredTrackingParams(): HandshakeTrackingParams {
  try {
    const storedValue = window.localStorage.getItem(TRACKING_STORAGE_KEY);

    if (!storedValue) {
      return {};
    }

    return parseTrackingRecord(JSON.parse(storedValue));
  } catch {
    return {};
  }
}

function parseTrackingRecord(value: unknown): HandshakeTrackingParams {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const candidate = value as Partial<Record<TrackingParamKey, unknown>>;
  const trackingParams: HandshakeTrackingParams = {};

  TRACKING_PARAM_KEYS.forEach((key) => {
    const paramValue = normalizeTrackingValue(candidate[key]);

    if (paramValue) {
      trackingParams[key] = paramValue;
    }
  });

  return trackingParams;
}

function persistTrackingParams(trackingParams: HandshakeTrackingParams) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(trackingParams));
}

function normalizeTrackingValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized ? normalized.slice(0, 240) : null;
}
