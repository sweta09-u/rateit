'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { CATEGORIES } from '@/lib/constants'
import { cx } from '@/lib/format'

/** Horizontally scrollable category chips, as on the reference layout. */
export function CategoryChips({ active }: { active?: string | null }) {
  const params = useSearchParams()
  const pathname = usePathname()
  const q = params.get('q')

  const href = (category?: string) => {
    const next = new URLSearchParams()
    if (category) next.set('category', category)
    if (q) next.set('q', q)
    const qs = next.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const chip = (key: string, label: string, isActive: boolean) => (
    <Link
      key={key}
      href={href(key || undefined)}
      aria-current={isActive ? 'true' : undefined}
      className={cx(
        'shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors duration-150',
        isActive
          ? 'bg-brand font-semibold text-brand-fg'
          : 'bg-surface font-medium text-fg hover:bg-surface2',
      )}
    >
      {label}
    </Link>
  )

  return (
    <div
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1 md:mx-0 md:px-0"
      role="list"
      aria-label="Filter by category"
    >
      {chip('', 'All', !active)}
      {CATEGORIES.map((category) => chip(category, category, active === category))}
    </div>
  )
}
