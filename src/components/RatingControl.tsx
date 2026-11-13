'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ratePost, removeMyRating } from '@/lib/api'
import { RATING_MAX, RATING_MIN } from '@/lib/constants'
import { friendlyError } from '@/lib/supabase'
import { cx, formatSigned, ratingTone } from '@/lib/format'
import { useAuth } from '@/context/AuthContext'
import type { RatingResult } from '@/lib/types'

const QUICK = [RATING_MIN, 0, RATING_MAX] as const

type Saving = number | 'slider' | 'remove' | null

/**
 * The −5…+10 rating control, ported from the existing app with the same
 * behaviour: one tap on −5 / 0 / +10 saves immediately, the slider commits any
 * value, and re-rating updates the single existing row (the database function
 * upserts on post_id + user_id).
 */
export function RatingControl({
  postId,
  postAuthorId,
  avg,
  count,
  myScore,
  onRated,
}: {
  postId: string
  postAuthorId: string
  avg: number | null
  count: number
  myScore: number | null
  onRated: (result: RatingResult) => void
}) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const [selected, setSelected] = useState<number>(myScore ?? 5)
  const [saving, setSaving] = useState<Saving>(null)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    setSelected(myScore ?? 5)
  }, [myScore])

  const isOwn = Boolean(user && user.id === postAuthorId)

  async function submit(value: number, key: Saving) {
    setSaving(key)
    setMessage(null)
    try {
      const result = await ratePost(postId, value)
      if (!alive.current) return
      onRated(result)
      setMessage({ text: `Saved ${formatSigned(value)}.`, ok: true })
    } catch (err) {
      if (alive.current) setMessage({ text: friendlyError(err), ok: false })
    } finally {
      if (alive.current) setSaving(null)
    }
  }

  async function clear() {
    setSaving('remove')
    setMessage(null)
    try {
      const result = await removeMyRating(postId)
      if (!alive.current) return
      onRated(result)
      setMessage({ text: 'Your rating was removed.', ok: true })
    } catch (err) {
      if (alive.current) setMessage({ text: friendlyError(err), ok: false })
    } finally {
      if (alive.current) setSaving(null)
    }
  }

  if (loading) {
    return <div className="h-24 animate-pulse rounded-xl bg-surface2" aria-hidden="true" />
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-line bg-bg/40 p-4">
        <p className="text-sm text-muted">
          {count === 0
            ? 'Not rated yet — be the first.'
            : `Rated by ${count} ${count === 1 ? 'person' : 'people'}.`}
        </p>
        <Link
          href="/login"
          className="mt-3 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover"
        >
          Sign in to rate this
        </Link>
        <p className="mt-2 text-xs text-muted">You will come back to this post.</p>
      </div>
    )
  }

  if (isOwn) {
    return (
      <p className="rounded-xl border border-line bg-bg/40 p-4 text-sm text-muted">
        This is your post, so you cannot rate it. The community decides its score.
      </p>
    )
  }

  const tone = ratingTone(selected)

  return (
    <div className="rounded-xl border border-line bg-bg/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-fg">Your rating</p>
        {myScore !== null && (
          <p className="text-xs text-muted">
            You rated this{' '}
            <span className="font-bold text-brand">{formatSigned(myScore)}</span>
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK.map((value) => (
          <button
            key={value}
            type="button"
            disabled={saving !== null}
            onClick={() => void submit(value, value)}
            aria-label={`Rate ${formatSigned(value)}`}
            className={cx(
              'rounded-lg px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-60',
              value === RATING_MAX
                ? 'bg-brand text-brand-fg hover:bg-brand-hover'
                : 'border border-line bg-surface text-fg hover:bg-surface2',
              myScore === value && 'ring-2 ring-brand ring-offset-2 ring-offset-bg',
            )}
          >
            {saving === value ? '…' : formatSigned(value)}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="w-8 shrink-0 text-right text-xs font-bold tabular-nums text-muted">
          {formatSigned(RATING_MIN)}
        </span>
        <input
          type="range"
          min={RATING_MIN}
          max={RATING_MAX}
          step={1}
          value={selected}
          onChange={(event) => setSelected(Number(event.target.value))}
          aria-label={`Rating from ${RATING_MIN} to ${RATING_MAX}`}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface2 accent-brand"
          style={{ accentColor: 'var(--brand)' }}
        />
        <span className="w-8 shrink-0 text-xs font-bold tabular-nums text-muted">
          {formatSigned(RATING_MAX)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{
            color:
              tone === 'neg' ? 'var(--neg)' : tone === 'pos' ? 'var(--brand)' : 'var(--fg)',
          }}
        >
          {formatSigned(selected)}
        </span>
        <button
          type="button"
          onClick={() => void submit(selected, 'slider')}
          disabled={saving !== null}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-60"
        >
          {saving === 'slider' ? 'Saving…' : myScore === null ? 'Submit rating' : 'Update rating'}
        </button>
        {myScore !== null && (
          <button
            type="button"
            onClick={() => void clear()}
            disabled={saving !== null}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted hover:bg-surface hover:text-fg disabled:opacity-60"
          >
            {saving === 'remove' ? 'Removing…' : 'Remove'}
          </button>
        )}
      </div>

      {message && (
        <p
          role="status"
          className="mt-3 text-sm font-medium"
          style={{ color: message.ok ? 'var(--brand)' : 'var(--neg)' }}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
