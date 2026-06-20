"use client";

import { SignUp } from "@clerk/nextjs";

import { toAbsoluteClerkUrl } from "@/lib/clerk-paths";

interface SignUpFormProps {
  path: string;
  signInUrl: string;
  fallbackRedirectUrl: string;
}

export default function SignUpForm({
  path,
  signInUrl,
  fallbackRedirectUrl,
}: SignUpFormProps) {
  const redirectUrl = toAbsoluteClerkUrl(fallbackRedirectUrl);
  const signInAbsolute = toAbsoluteClerkUrl(signInUrl);

  return (
    <SignUp
      path={path}
      signInUrl={signInAbsolute}
      fallbackRedirectUrl={redirectUrl}
      forceRedirectUrl={redirectUrl}
    />
  );
}
