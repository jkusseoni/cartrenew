'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'

function isShopifyEmbeddedRoute(pathname: string) {
  return (
    pathname === '/app' ||
    pathname.startsWith('/app/') ||
    pathname === '/shopify' ||
    pathname.startsWith('/shopify/')
  )
}

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''

  // Clerk must not load inside the Shopify Admin iframe — it triggers CSP /
  // third-party cookie blocks and breaks App Bridge embedding.
  if (isShopifyEmbeddedRoute(pathname)) {
    return <>{children}</>
  }

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
