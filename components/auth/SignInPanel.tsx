"use client";

import dynamic from "next/dynamic";

const SignInForm = dynamic(() => import("@/components/auth/SignInForm"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[420px] w-full max-w-md items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-950/40 px-6 py-12 text-sm text-neutral-400">
      Loading sign in...
    </div>
  ),
});

interface SignInPanelProps {
  path: string;
  signUpUrl: string;
  fallbackRedirectUrl: string;
}

export default function SignInPanel({
  path,
  signUpUrl,
  fallbackRedirectUrl,
}: SignInPanelProps) {
  return (
    <SignInForm
      path={path}
      signUpUrl={signUpUrl}
      fallbackRedirectUrl={fallbackRedirectUrl}
    />
  );
}
