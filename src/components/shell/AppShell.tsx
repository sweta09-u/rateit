'use client'

import { useState } from 'react'
import { cx } from '@/lib/format'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileNav } from './MobileNav'
import { SetupNotice } from '@/components/SetupNotice'
import { isConfigured } from '@/lib/supabase'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!isConfigured) return <SetupNotice />

  return (
    <div className="min-h-screen bg-bg text-fg">
      <TopBar
        collapsed={collapsed}
        onToggleSidebar={() => setCollapsed((v) => !v)}
        onOpenMenu={() => setMobileOpen((v) => !v)}
      />

      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />

      <main
        id="main"
        className={cx(
          'pb-24 pt-14 transition-[padding] duration-200 ease-smooth md:pb-10',
          collapsed ? 'md:pl-[72px]' : 'md:pl-60',
        )}
      >
        {children}
      </main>

      <MobileNav />
    </div>
  )
}
