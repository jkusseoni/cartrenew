'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'

import { brand } from '@/lib/brand'
import { isShopifyEntryPath } from '@/lib/shopify/embed-routes'

function isShopifyEmbeddedPath(pathname: string) {
  return isShopifyEntryPath(pathname)
}

/** True when Shopify Admin is embedding this page (shop + host query). */
function hasShopifyEmbedQuery(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    return Boolean(params.get('host') && params.get('shop'))
  } catch {
    return false
  }
}

/**
 * Clerk must not load inside the Shopify Admin iframe — third-party cookies
 * to *.clerk.accounts.dev fail and produce "redirected you too many times".
 *
 * Pingza (!brand.isDefault): also skip when the URL looks like an Admin launch
 * (empty pathname on first paint, or shop+host on `/`).
 * CartRenew: same /app|/shopify skip as before.
 */
export function shouldSkipClerkProvider(pathname: string): boolean {
  if (isShopifyEmbeddedPath(pathname)) return true

  if (typeof window !== 'undefined') {
    const livePath = window.location.pathname || ''
    if (isShopifyEmbeddedPath(livePath)) return true
    if (!brand.isDefault && hasShopifyEmbedQuery()) return true
  }

  return false
}

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''

  if (shouldSkipClerkProvider(pathname)) {
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
