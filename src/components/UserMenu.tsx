'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { initials } from '@/lib/format'

/** Avatar menu, or a sign-in link when there is no session. */
export function UserMenu() {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  if (loading) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-surface2" aria-hidden="true" />
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-semibold text-fg hover:bg-surface"
      >
        <UserIcon size={15} aria-hidden="true" />
        Sign in
      </Link>
    )
  }

  const name = profile?.display_name || profile?.username || 'You'
  const label = initials(name)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${name}`}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand text-xs font-bold text-brand-fg"
      >
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          label
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-lift"
          >
            <div className="border-b border-line px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-fg">{name}</p>
              <p className="truncate text-xs text-muted">@{profile?.username ?? '…'}</p>
            </div>
            {profile && (
              <Link
                href={`/u/${profile.username}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-fg hover:bg-surface2"
                role="menuitem"
              >
                <UserIcon size={15} aria-hidden="true" />
                Your profile
              </Link>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setOpen(false)
                await signOut()
                router.push('/')
                router.refresh()
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-fg hover:bg-surface2"
            >
              <LogOut size={15} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </>
      )}

      {/* keep the current path in the URL so sign-in can return here */}
      <span className="hidden" aria-hidden="true">
        {pathname}
      </span>
    </div>
  )
}
