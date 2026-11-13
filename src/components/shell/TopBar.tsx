'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, Monitor, Moon, PanelLeft, Plus, Search, Sun, X } from 'lucide-react'
import { UserMenu } from '@/components/UserMenu'
import {
  applyTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  type ThemeChoice,
} from '@/lib/theme'

const NEXT_THEME: Record<ThemeChoice, ThemeChoice> = {
  dark: 'light',
  light: 'system',
  system: 'dark',
}

const THEME_LABEL: Record<ThemeChoice, string> = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
}

export function TopBar({
  collapsed,
  onToggleSidebar,
  onOpenMenu,
}: {
  collapsed: boolean
  onToggleSidebar: () => void
  onOpenMenu: () => void
}) {
  const router = useRouter()
  const [term, setTerm] = useState('')
  const [choice, setChoice] = useState<ThemeChoice>('dark')
  const [searchOpen, setSearchOpen] = useState(false)

  // Read the stored choice after mount so server and client markup match.
  useEffect(() => {
    setChoice(readStoredTheme())
  }, [])

  function cycleTheme() {
    const next = NEXT_THEME[choice]
    setChoice(next)
    storeTheme(next)
    applyTheme(resolveTheme(next))
  }

  function go(event: React.FormEvent) {
    event.preventDefault()
    const q = term.trim()
    setSearchOpen(false)
    router.push(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore')
  }

  const ThemeIcon = choice === 'light' ? Sun : choice === 'system' ? Monitor : Moon

  const input = (
    <div className="relative w-full">
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        type="search"
        placeholder="Search anything to rate…"
        aria-label="Search posts"
        className="h-10 w-full rounded-full border border-line bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
    </div>
  )

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-line bg-bg/95 px-3 backdrop-blur md:gap-4 md:px-4">
        <button
          type="button"
          onClick={onOpenMenu}
          className="rounded-lg p-2 text-fg hover:bg-surface md:hidden"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden rounded-lg p-2 text-fg hover:bg-surface md:block"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
        >
          <PanelLeft size={20} />
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="rabrate — home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.svg" alt="" width={30} height={30} className="rounded-lg" />
          <span className="hidden text-[18px] font-extrabold tracking-tight text-fg sm:block">
            rabrate
          </span>
        </Link>

        {/* Inline search from 640px up; below that it becomes an overlay. */}
        <form onSubmit={go} className="mx-auto hidden w-full max-w-xl sm:flex" role="search">
          {input}
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
          <Link
            href="/new"
            className="hidden h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-sm font-semibold text-fg hover:bg-surface2 sm:flex"
          >
            <Plus size={16} aria-hidden="true" />
            Create
          </Link>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="rounded-lg p-2 text-fg hover:bg-surface sm:hidden"
            aria-label="Search"
          >
            <Search size={20} />
          </button>
          <button
            type="button"
            onClick={cycleTheme}
            className="rounded-lg p-2 text-muted hover:bg-surface hover:text-fg"
            aria-label={`Theme: ${THEME_LABEL[choice]}. Click for ${THEME_LABEL[NEXT_THEME[choice]]}.`}
            title={`Theme: ${THEME_LABEL[choice]}`}
          >
            <ThemeIcon size={19} />
          </button>
          <UserMenu />
        </div>
      </header>

      {/* Mobile search: full width, autofocused, no cramped inline field. */}
      {searchOpen && (
        <div className="fixed inset-0 z-[55] flex flex-col bg-bg sm:hidden">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3">
            <form onSubmit={go} className="flex-1" role="search">
              {input}
            </form>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="rounded-lg p-2 text-muted hover:bg-surface hover:text-fg"
              aria-label="Close search"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-4 text-sm text-muted">
            Type a title or keyword, then press enter.
          </div>
        </div>
      )}
    </>
  )
}
