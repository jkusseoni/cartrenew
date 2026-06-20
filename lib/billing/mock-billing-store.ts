import type { TrialBillingSnapshot } from "@/lib/billing/trial-access";
import type { SubscriptionStatus } from "@/lib/billing/trial-config";
import { TRIAL_DURATION_DAYS } from "@/lib/billing/trial-config";

const STORAGE_PREFIX = "cartrenew_billing";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function readMockBillingSnapshot(userId: string): TrialBillingSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as TrialBillingSnapshot;
  } catch {
    return null;
  }
}

export function writeMockBillingSnapshot(userId: string, snapshot: TrialBillingSnapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(snapshot));
}

/** Seed a 14-day trial on first dashboard visit for the signed-in user. */
export function ensureMockTrialStarted(userId: string): TrialBillingSnapshot {
  const existing = readMockBillingSnapshot(userId);
  if (existing) return existing;

  const snapshot: TrialBillingSnapshot = {
    trialStartedAt: new Date().toISOString(),
    subscriptionStatus: "TRIAL",
  };

  writeMockBillingSnapshot(userId, snapshot);
  return snapshot;
}

export function markMockSubscriptionPaid(userId: string) {
  const current = readMockBillingSnapshot(userId);
  if (!current) return;

  writeMockBillingSnapshot(userId, {
    ...current,
    subscriptionStatus: "PAID",
  });
}

/** Dev helper: backdate trial start so the billing gate can be exercised locally. */
export function mockExpiredTrial(userId: string) {
  const started = new Date();
  started.setDate(started.getDate() - (TRIAL_DURATION_DAYS + 1));

  writeMockBillingSnapshot(userId, {
    trialStartedAt: started.toISOString(),
    subscriptionStatus: "TRIAL",
  });
}

export type { SubscriptionStatus };
