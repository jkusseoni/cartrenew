"use client";

import dynamic from "next/dynamic";

const SignUpForm = dynamic(() => import("@/components/auth/SignUpForm"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[420px] w-full max-w-md items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-950/40 px-6 py-12 text-sm text-neutral-400">
      Loading sign up...
    </div>
  ),
});

interface SignUpPanelProps {
  path: string;
  signInUrl: string;
  fallbackRedirectUrl: string;
}

export default function SignUpPanel({
  path,
  signInUrl,
  fallbackRedirectUrl,
}: SignUpPanelProps) {
  return (
    <SignUpForm
      path={path}
      signInUrl={signInUrl}
      fallbackRedirectUrl={fallbackRedirectUrl}
    />
  );
}
