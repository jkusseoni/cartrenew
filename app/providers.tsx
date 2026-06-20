'use client'

import { ClerkProvider } from '@clerk/nextjs'

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/en/sign-in"
      signUpUrl="/en/sign-up"
      signInForceRedirectUrl="/en/dashboard"
      signUpForceRedirectUrl="/en/dashboard"
      afterSignOutUrl="/en"
    >
      {children}
    </ClerkProvider>
  )
}
