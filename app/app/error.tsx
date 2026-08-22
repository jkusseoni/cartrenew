"use client";

/**
 * Embedded app error boundary — never show Next.js default error chrome
 * inside Shopify Admin (App Store review 2.1.1).
 */
export default function EmbeddedAppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#0B0F17] text-white flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-neutral-800 bg-neutral-950/40 p-8 text-center">
        <h1 className="text-xl font-black">Almost ready</h1>
        <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
          CartRenew hit a temporary snag loading your store. This is safe to
          retry — your install is not lost.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-xl bg-[#00DF89] px-5 py-2.5 text-xs font-black text-neutral-950 transition hover:bg-[#00c978]"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
