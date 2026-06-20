"use client";

import { SignIn } from "@clerk/nextjs";

import { toAbsoluteClerkUrl } from "@/lib/clerk-paths";

interface SignInFormProps {
  path: string;
  signUpUrl: string;
  fallbackRedirectUrl: string;
}

export default function SignInForm({
  path,
  signUpUrl,
  fallbackRedirectUrl,
}: SignInFormProps) {
  const redirectUrl = toAbsoluteClerkUrl(fallbackRedirectUrl);
  const signUpAbsolute = toAbsoluteClerkUrl(signUpUrl);

  return (
    <SignIn
      path={path}
      signUpUrl={signUpAbsolute}
      fallbackRedirectUrl={redirectUrl}
      forceRedirectUrl={redirectUrl}
    />
  );
}
