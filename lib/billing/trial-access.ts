import { TRIAL_DURATION_DAYS, type SubscriptionStatus } from "@/lib/billing/trial-config";

export type TrialBillingSnapshot = {
  trialStartedAt: string;
  subscriptionStatus: SubscriptionStatus;
};

export type TrialAccessResult = {
  daysRemaining: number;
  isPaid: boolean;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  isWorkspaceBlocked: boolean;
  trialStartedAt: Date;
  trialEndsAt: Date;
};

export function getTrialEndsAt(trialStartedAt: Date): Date {
  const endsAt = new Date(trialStartedAt);
  endsAt.setDate(endsAt.getDate() + TRIAL_DURATION_DAYS);
  return endsAt;
}

export function getDaysRemaining(trialStartedAt: Date, now = new Date()): number {
  const endsAt = getTrialEndsAt(trialStartedAt);
  const msRemaining = endsAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
}

export function evaluateTrialAccess(
  snapshot: TrialBillingSnapshot,
  now = new Date()
): TrialAccessResult {
  const trialStartedAt = new Date(snapshot.trialStartedAt);
  const trialEndsAt = getTrialEndsAt(trialStartedAt);
  const daysRemaining = getDaysRemaining(trialStartedAt, now);
  const isPaid = snapshot.subscriptionStatus === "PAID";
  const isTrialExpired = now.getTime() > trialEndsAt.getTime();
  const isTrialActive = !isPaid && !isTrialExpired;
  const isWorkspaceBlocked = isTrialExpired && !isPaid;

  return {
    daysRemaining,
    isPaid,
    isTrialActive,
    isTrialExpired,
    isWorkspaceBlocked,
    trialStartedAt,
    trialEndsAt,
  };
}

/** Mock billing gate — mirrors what production middleware would enforce. */
export function mockBillingMiddlewareGate(
  snapshot: TrialBillingSnapshot,
  now = new Date()
): { allowed: boolean; reason?: string; access: TrialAccessResult } {
  const access = evaluateTrialAccess(snapshot, now);

  if (access.isWorkspaceBlocked) {
    return {
      allowed: false,
      reason: "Trial expired — upgrade to a paid plan to resume store recovery operations.",
      access,
    };
  }

  return { allowed: true, access };
}
