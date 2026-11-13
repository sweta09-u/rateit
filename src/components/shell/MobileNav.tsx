'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Flame, Home, Plus, Trophy } from 'lucide-react'
import { cx } from '@/lib/format'

const LEFT = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/explore', label: 'Explore', icon: Compass },
]

const RIGHT = [
  { href: '/trending', label: 'Trending', icon: Flame },
  { href: '/leaderboard', label: 'Ranks', icon: Trophy },
]

/**
 * Mobile navigation. The create action sits in the middle as a raised button:
 * it is the primary thing to do here, and on a phone the top bar has no room
 * for it. Without this there was no way to post at all below 640px.
 */
export function MobileNav() {
  const pathname = usePathname()

  const item = ({ href, label, icon: Icon }: (typeof LEFT)[number]) => {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cx(
          'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] transition-colors',
          active ? 'font-semibold text-fg' : 'font-medium text-muted',
        )}
      >
        <Icon
          size={21}
          strokeWidth={active ? 2.4 : 2}
          className={cx(active && 'text-brand')}
          aria-hidden="true"
        />
        {label}
      </Link>
    )
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-line bg-bg/95 backdrop-blur md:hidden"
      aria-label="Primary"
    >
      {LEFT.map(item)}

      <Link
        href="/new"
        aria-label="Create a post"
        className="flex flex-1 flex-col items-center justify-center"
      >
        <span
          className={cx(
            'flex h-10 w-10 items-center justify-center rounded-full bg-brand text-brand-fg transition-transform active:scale-95',
            pathname === '/new' && 'ring-2 ring-brand ring-offset-2 ring-offset-bg',
          )}
        >
          <Plus size={22} strokeWidth={2.6} aria-hidden="true" />
        </span>
      </Link>

      {RIGHT.map(item)}
    </nav>
  )
}
