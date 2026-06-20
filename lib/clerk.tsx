'use client'

import { useClerk, useUser, UserButton as ClerkUserButton } from '@clerk/nextjs'

const skipClerk =
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
  const clerkState = useUser()

  if (skipClerk) {
    return {
      user: fakeUser,
      isLoaded: true,
      isSignedIn: true,
    }
  }

  return clerkState
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

interface LogoutButtonProps {
  className?: string
  children?: React.ReactNode
}

export function LogoutButton({ className, children = 'Logout' }: LogoutButtonProps) {
  const { signOut } = useClerk()

  const handleLogout = async () => {
    if (skipClerk) {
      window.location.assign('/en')
      return
    }

    try {
      await signOut({ redirectUrl: '/en' })
    } catch (error) {
      console.warn('Clerk signOut failed, redirecting to landing page:', error)
      window.location.assign('/en')
    }
  }

  return (
    <button type="button" onClick={handleLogout} className={className}>
      {children}
    </button>
  )
}
