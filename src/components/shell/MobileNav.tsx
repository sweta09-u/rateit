'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Flame, Home, Trophy } from 'lucide-react'
import { cx } from '@/lib/format'

const ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/trending', label: 'Trending', icon: Flame },
  { href: '/leaderboard', label: 'Ranks', icon: Trophy },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-line bg-bg/95 backdrop-blur md:hidden"
      aria-label="Primary"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
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
            <Icon size={21} strokeWidth={active ? 2.4 : 2} className={cx(active && 'text-brand')} aria-hidden="true" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
