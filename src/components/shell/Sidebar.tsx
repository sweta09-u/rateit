'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Compass,
  Flame,
  Home,
  LayoutGrid,
  Settings,
  ShieldCheck,
  Trophy,
  X,
} from 'lucide-react'
import { cx } from '@/lib/format'
import { useAuth } from '@/context/AuthContext'

/**
 * Only destinations backed by real data are listed. Shorts, Subscriptions,
 * Watch Later, History and Liked were in the brief but have no tables behind
 * them, so they are deliberately absent rather than dead links.
 */
const PRIMARY = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/trending', label: 'Trending', icon: Flame },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
]

const MORE = [
  { href: '/explore#categories', label: 'Categories', icon: LayoutGrid },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/rules', label: 'Rules', icon: ShieldCheck },
]

export function Sidebar({
  collapsed,
  mobileOpen,
  onNavigate,
}: {
  collapsed: boolean
  mobileOpen: boolean
  onNavigate: () => void
}) {
  const pathname = usePathname()
  const { isModerator } = useAuth()

  const item = (entry: (typeof PRIMARY)[number], wide: boolean) => {
    const active =
      entry.href === '/' ? pathname === '/' : pathname.startsWith(entry.href.split('#')[0])
    const Icon = entry.icon
    return (
      <Link
        key={entry.href}
        href={entry.href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        title={collapsed && wide ? entry.label : undefined}
        className={cx(
          'group flex items-center gap-4 rounded-xl px-3 py-2.5 text-sm transition-colors duration-150 ease-smooth',
          wide ? '' : 'justify-center',
          active
            ? 'bg-surface2 font-semibold text-fg'
            : 'font-medium text-muted hover:bg-surface hover:text-fg',
        )}
      >
        <Icon
          size={20}
          strokeWidth={active ? 2.4 : 2}
          className={cx('shrink-0', active && 'text-brand')}
          aria-hidden="true"
        />
        {wide && <span className="truncate">{entry.label}</span>}
      </Link>
    )
  }

  const body = (wide: boolean) => (
    <>
      <nav aria-label="Sections" className="flex flex-col gap-1">
        {PRIMARY.map((entry) => item(entry, wide))}
      </nav>

      <hr className="my-3 border-line" />

      <nav aria-label="More" className="flex flex-col gap-1">
        {MORE.map((entry) => item(entry as (typeof PRIMARY)[number], wide))}
        {isModerator &&
          item(
            { href: '/moderation', label: 'Moderation', icon: ShieldCheck } as (typeof PRIMARY)[number],
            wide,
          )}
      </nav>

      {wide && (
        <p className="mt-auto px-3 pt-6 text-[11px] leading-relaxed text-muted/70">
          rabrate — your opinion, scored −5 to +10.
        </p>
      )}
    </>
  )

  return (
    <>
      {/* Desktop */}
      <aside
        className={cx(
          'fixed bottom-0 left-0 top-14 z-30 hidden flex-col overflow-y-auto border-r border-line bg-bg px-2 py-3 transition-[width] duration-200 ease-smooth md:flex',
          collapsed ? 'w-[72px]' : 'w-60',
        )}
        aria-label="Sidebar"
      >
        {body(!collapsed)}
      </aside>

      {/* Mobile slide-over */}
      <div
        className={cx(
          'fixed inset-0 z-50 md:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cx(
            'absolute inset-0 bg-black/60 transition-opacity duration-200',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={onNavigate}
        />
        <aside
          className={cx(
            'absolute bottom-0 left-0 top-0 flex w-64 flex-col overflow-y-auto border-r border-line bg-bg px-2 py-3 transition-transform duration-200 ease-smooth',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          aria-label="Sidebar"
        >
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-sm font-semibold">Menu</span>
            <button
              type="button"
              onClick={onNavigate}
              className="rounded-lg p-2 text-muted hover:bg-surface hover:text-fg"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
          {body(true)}
        </aside>
      </div>
    </>
  )
}
