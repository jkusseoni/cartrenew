"use client";

import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

export type DashboardCart = {
  id: number;
  customerName: string;
  phoneNumber: string;
  totalAmount: number;
  cartTotalAmount?: number | null;
  cartUrl: string;
  paymentUrl?: string | null;
  payment_url?: string | null;
  offerType?: string | null;
  status: string;
  notified: boolean;
  recoveryMessage: string | null;
  recoveryMessageModel: string | null;
  recoveryMessagePrompt: string | null;
  recoveryMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DashboardMetrics = {
  totalRecoveredCarts: number;
  currentActiveCarts: number;
  totalCarts: number;
};

type DashboardListenerStatus = "idle" | "loading" | "connected" | "error";

type DashboardListenerState = {
  carts: DashboardCart[];
  metrics: DashboardMetrics;
  status: DashboardListenerStatus;
  error: string | null;
  refresh: () => Promise<void>;
};

type DashboardListenerProps = {
  initialCarts?: DashboardCart[];
  className?: string;
  onCartsChange?: (carts: DashboardCart[], metrics: DashboardMetrics) => void;
  onUpdate?: (cart: DashboardCart) => void;
  render?: (state: DashboardListenerState) => ReactNode;
};

type DashboardDatabase = {
  public: {
    Tables: {
      Cart: {
        Row: DashboardCart;
        Insert: Partial<DashboardCart>;
        Update: Partial<DashboardCart>;
      };
    };
  };
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const missingSupabaseEnvError =
  !SUPABASE_URL || !SUPABASE_ANON_KEY
    ? "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    : null;

const recoveredStatuses = new Set(["recovered", "converted", "completed", "paid"]);
const inactiveStatuses = new Set([
  "recovered",
  "converted",
  "completed",
  "paid",
  "lost",
  "failed",
  "failed_permanently",
  "opted_out",
  "cancelled",
  "canceled",
]);

function normalizeStatus(status: string) {
  return status.trim().toLowerCase();
}

function sortCarts(carts: DashboardCart[]) {
  return [...carts].sort((a, b) => {
    const bTime = Date.parse(b.updatedAt || b.createdAt);
    const aTime = Date.parse(a.updatedAt || a.createdAt);
    return bTime - aTime;
  });
}

function mergeCart(carts: DashboardCart[], incomingCart: DashboardCart) {
  const existingIndex = carts.findIndex((cart) => cart.id === incomingCart.id);

  if (existingIndex === -1) {
    return sortCarts([incomingCart, ...carts]);
  }

  const nextCarts = [...carts];
  nextCarts[existingIndex] = {
    ...nextCarts[existingIndex],
    ...incomingCart,
  };

  return sortCarts(nextCarts);
}

function getMetrics(carts: DashboardCart[]): DashboardMetrics {
  return carts.reduce(
    (metrics, cart) => {
      const status = normalizeStatus(cart.status);

      if (recoveredStatuses.has(status)) {
        metrics.totalRecoveredCarts += 1;
      }

      if (!inactiveStatuses.has(status)) {
        metrics.currentActiveCarts += 1;
      }

      return metrics;
    },
    {
      totalRecoveredCarts: 0,
      currentActiveCarts: 0,
      totalCarts: carts.length,
    }
  );
}

export default function DashboardListener({
  initialCarts = [],
  className = "",
  onCartsChange,
  onUpdate,
  render,
}: DashboardListenerProps) {
  const [carts, setCarts] = useState<DashboardCart[]>(() => sortCarts(initialCarts));
  const [status, setStatus] = useState<DashboardListenerStatus>(() =>
    missingSupabaseEnvError ? "error" : "idle"
  );
  const [error, setError] = useState<string | null>(() => missingSupabaseEnvError);

  const supabase = useMemo(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return null;
    }

    return createClient<DashboardDatabase>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }, []);

  const metrics = useMemo(() => getMetrics(carts), [carts]);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setStatus("error");
      setError(missingSupabaseEnvError);
      return;
    }

    setStatus((currentStatus) => (currentStatus === "connected" ? currentStatus : "loading"));
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("Cart")
      .select("*")
      .order("updatedAt", { ascending: false });

    if (fetchError) {
      setStatus("error");
      setError(fetchError.message);
      return;
    }

    setCarts(sortCarts(data ?? []));
  }, [supabase]);

  useEffect(() => {
    onCartsChange?.(carts, metrics);
  }, [carts, metrics, onCartsChange]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isActive = true;

    const loadInitialCarts = async () => {
      const { data, error: fetchError } = await supabase
        .from("Cart")
        .select("*")
        .order("updatedAt", { ascending: false });

      if (!isActive) {
        return;
      }

      if (fetchError) {
        setStatus("error");
        setError(fetchError.message);
        return;
      }

      setCarts(sortCarts(data ?? []));
    };

    void loadInitialCarts();

    const channel = supabase
      .channel("dashboard-cart-listener")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Cart" },
        (payload: { new: DashboardCart }) => {
          onUpdate?.(payload.new);
          setCarts((currentCarts) => mergeCart(currentCarts, payload.new));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "Cart" },
        (payload: { new: DashboardCart }) => {
          onUpdate?.(payload.new);
          setCarts((currentCarts) => mergeCart(currentCarts, payload.new));
        }
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === "SUBSCRIBED") {
          setStatus("connected");
          setError(null);
          return;
        }

        if (subscriptionStatus === "CHANNEL_ERROR" || subscriptionStatus === "TIMED_OUT") {
          setStatus("error");
          setError(`Supabase realtime subscription ${subscriptionStatus.toLowerCase()}.`);
        }
      });

    return () => {
      isActive = false;
      void supabase.removeChannel(channel);
    };
  }, [onUpdate, supabase]);

  const state = {
    carts,
    metrics,
    status,
    error,
    refresh,
  };

  if (render) {
    return <>{render(state)}</>;
  }

  return (
    <section className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${className}`}>
      <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
        <p className="text-xs font-medium uppercase text-zinc-400">Total Recovered Carts</p>
        <p className="mt-1 text-2xl font-bold text-emerald-400">{metrics.totalRecoveredCarts}</p>
      </div>

      <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
        <p className="text-xs font-medium uppercase text-zinc-400">Current Active Carts</p>
        <p className="mt-1 text-2xl font-bold text-blue-400">{metrics.currentActiveCarts}</p>
      </div>

      {error ? (
        <p className="md:col-span-2 rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      ) : null}

      <p className="sr-only" aria-live="polite">
        Dashboard cart listener status: {status}
      </p>
    </section>
  );
}
