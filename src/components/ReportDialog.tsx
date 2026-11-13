'use client'

import { useState } from 'react'
import { Modal } from './ui/Modal'
import { REPORT_REASONS, LIMITS } from '@/lib/constants'
import { submitReport } from '@/lib/api'
import { friendlyError } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { ReportReason, ReportTarget } from '@/lib/types'

/** Report a post, comment or account. Goes into the same moderation queue. */
export function ReportDialog({
  targetType,
  targetId,
  targetLabel,
  onClose,
}: {
  targetType: ReportTarget
  targetId: string
  targetLabel: string
  onClose: () => void
}) {
  const { user } = useAuth()
  const [reason, setReason] = useState<ReportReason>('spam')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function send() {
    if (!user) {
      setError('You need to be signed in to report.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await submitReport({
        reporterId: user.id,
        targetType,
        targetId,
        reason,
        details: details.trim() || null,
      })
      setSent(true)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={sent ? 'Report sent' : 'Report'}
      onClose={onClose}
      footer={
        sent ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover"
          >
            Done
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted hover:bg-surface2 hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send report'}
            </button>
          </>
        )
      }
    >
      {sent ? (
        <p className="text-sm text-muted">
          Thanks — a moderator will review {targetLabel}.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">Reporting {targetLabel}.</p>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-fg">Why?</legend>
            {REPORT_REASONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface2"
              >
                <input
                  type="radio"
                  name="reason"
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                  className="accent-[var(--brand)]"
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Anything else (optional)</span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={LIMITS.commentMax}
              className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm font-medium" style={{ color: 'var(--neg)' }}>
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
