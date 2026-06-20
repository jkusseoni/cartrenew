"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";

import {
  ensureMockTrialStarted,
  readMockBillingSnapshot,
} from "@/lib/billing/mock-billing-store";
import {
  evaluateTrialAccess,
  mockBillingMiddlewareGate,
  type TrialAccessResult,
} from "@/lib/billing/trial-access";

type TrialBillingState = {
  ready: boolean;
  access: TrialAccessResult | null;
  gateBlocked: boolean;
  gateReason?: string;
};

const FALLBACK_USER_KEY = "guest";

export function useTrialBilling(): TrialBillingState {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? FALLBACK_USER_KEY;
  const [snapshotVersion, setSnapshotVersion] = useState(0);

  useEffect(() => {
    if (!isLoaded) return;
    ensureMockTrialStarted(userId);
    setSnapshotVersion((v) => v + 1);
  }, [isLoaded, userId]);

  // Re-evaluate once per day boundary while the dashboard is open.
  useEffect(() => {
    if (!isLoaded) return;

    const tick = () => setSnapshotVersion((v) => v + 1);
    const interval = window.setInterval(tick, 60_000);
    return () => window.clearInterval(interval);
  }, [isLoaded]);

  return useMemo(() => {
    if (!isLoaded) {
      return { ready: false, access: null, gateBlocked: false };
    }

    const snapshot = readMockBillingSnapshot(userId) ?? ensureMockTrialStarted(userId);
    const gate = mockBillingMiddlewareGate(snapshot);
    void snapshotVersion;

    return {
      ready: true,
      access: gate.access,
      gateBlocked: !gate.allowed,
      gateReason: gate.reason,
    };
  }, [isLoaded, userId, snapshotVersion]);
}
