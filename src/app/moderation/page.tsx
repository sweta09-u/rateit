'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  fetchReports,
  logModerationAction,
  setUserBanned,
  updateReportStatus,
} from '@/lib/api'
import { friendlyError } from '@/lib/supabase'
import { reasonLabel, timeAgo } from '@/lib/format'
import type { Report } from '@/lib/types'
import { useAuth } from '@/context/AuthContext'

export default function ModerationPage() {
  const router = useRouter()
  const { user, profile, loading, isModerator } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  const load = useCallback(async () => {
    setFetching(true)
    setError(null)
    try {
      setReports(await fetchReports())
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    if (isModerator) void load()
    else if (!loading) setFetching(false)
  }, [isModerator, loading, load])

  async function act(report: Report, status: 'resolved' | 'dismissed') {
    if (!user) return
    setBusy(report.id)
    try {
      await updateReportStatus(report.id, status, user.id)
      await logModerationAction({
        action: status === 'resolved' ? 'resolve_report' : 'dismiss_report',
        targetType: report.target_type,
        targetId: report.target_id,
        notes: report.reason,
      })
      await load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  async function ban(report: Report) {
    setBusy(report.id)
    try {
      await setUserBanned(report.target_id, true)
      await logModerationAction({
        action: 'ban_user',
        targetType: 'user',
        targetId: report.target_id,
        notes: report.reason,
      })
      await load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  if (loading || fetching) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <div className="h-40 animate-pulse rounded-xl bg-surface" />
      </div>
    )
  }

  if (!isModerator) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center md:px-6">
        <h1 className="text-xl font-bold">Moderators only</h1>
        <p className="mt-2 text-sm text-muted">
          This page is for accounts with the moderator role.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover"
        >
          Back to the feed
        </Link>
      </div>
    )
  }

  const open = reports.filter((r) => r.status === 'open' || r.status === 'reviewing')

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Moderation</h1>
          <p className="mt-0.5 text-sm text-muted">
            Signed in as @{profile?.username} · {open.length} open{' '}
            {open.length === 1 ? 'report' : 'reports'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface2"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm font-medium" style={{ color: 'var(--neg)' }}>
          {error}
        </p>
      )}

      {open.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line bg-surface/50 px-4 py-10 text-center text-sm text-muted">
          Nothing to review. The queue is clear.
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {open.map((report) => (
            <li key={report.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-brand-soft px-1.5 py-0.5 font-bold uppercase tracking-wide text-brand">
                  {report.target_type}
                </span>
                <span className="font-semibold text-fg">{reasonLabel(report.reason)}</span>
                <span className="text-muted">{timeAgo(report.created_at)}</span>
                {report.reporter && (
                  <span className="text-muted">by @{report.reporter.username}</span>
                )}
              </div>

              {report.details && (
                <p className="mt-2 text-sm text-fg/85">{report.details}</p>
              )}

              <p className="mt-1 truncate text-xs text-muted">
                target {report.target_id}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={report.target_type === 'post' ? `/post/${report.target_id}` : '/'}
                  className="rounded-lg border border-line px-2.5 py-1.5 text-sm font-medium hover:bg-surface2"
                >
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => void act(report, 'resolved')}
                  disabled={busy === report.id}
                  className="rounded-lg bg-brand px-2.5 py-1.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-60"
                >
                  Resolve
                </button>
                <button
                  type="button"
                  onClick={() => void act(report, 'dismissed')}
                  disabled={busy === report.id}
                  className="rounded-lg border border-line px-2.5 py-1.5 text-sm font-medium hover:bg-surface2 disabled:opacity-60"
                >
                  Dismiss
                </button>
                {report.target_type === 'user' && (
                  <button
                    type="button"
                    onClick={() => void ban(report)}
                    disabled={busy === report.id}
                    className="rounded-lg border px-2.5 py-1.5 text-sm font-semibold disabled:opacity-60"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--neg) 45%, transparent)',
                      color: 'var(--neg)',
                    }}
                  >
                    Suspend user
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
