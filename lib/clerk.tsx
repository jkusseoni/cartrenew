'use client'

import { useUser, UserButton as ClerkUserButton } from '@clerk/nextjs'

const skipClerk =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_SKIP_CLERK === 'true' ||
  process.env.SKIP_CLERK === 'true'

const fakeUser = {
  id: 'local-dev',
  firstName: 'Local',
  lastName: 'Developer',
  fullName: 'Local Developer',
  primaryEmailAddress: { emailAddress: 'local@localhost' },
  emailAddresses: [{ emailAddress: 'local@localhost' }],
}

export function useSafeUser() {
  if (skipClerk) {
    return {
      user: fakeUser,
      isLoaded: true,
      isSignedIn: true,
    }
  }

  return useUser()
}

export function SafeUserButton() {
  if (skipClerk) {
    return (
      <div className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700">
        Local Dev
      </div>
    )
  }

  return <ClerkUserButton />
}
