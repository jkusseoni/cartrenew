"use client";

import { RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect } from "react";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route failed:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-xl flex-col items-start gap-5 rounded-lg border border-rose-200 bg-white p-6 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Dashboard could not load
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The recovery metrics hit a temporary issue while loading.
          </p>
        </div>

        <button
          type="button"
          onClick={() => unstable_retry()}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </section>
    </main>
  );
}
