'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, MessageSquare } from 'lucide-react'
import {
  createComment,
  deletePost,
  deleteComment,
  fetchComments,
  fetchMyRating,
  fetchPost,
  fetchRatingBreakdown,
} from '@/lib/api'
import { friendlyError } from '@/lib/supabase'
import { formatAverage, formatSigned, timeAgo } from '@/lib/format'
import { validateComment } from '@/lib/validate'
import type { Comment, PostDetail, RatingBreakdownRow } from '@/lib/types'
import { RatingChip } from '@/components/RatingChip'
import { RatingControl } from '@/components/RatingControl'
import { EditPostDialog, type PostEditValues } from '@/components/EditPostDialog'
import { ReportDialog } from '@/components/ReportDialog'
import { useAuth } from '@/context/AuthContext'
import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Content detail. Read-only for now: the rating control and comment composer
 * need the auth session, which is the next phase of this migration. The
 * community score, distribution and existing comments are all real.
 */
export default function PostPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const { user } = useAuth()
  const router = useRouter()

  const [post, setPost] = useState<PostDetail | null>(null)
  const [breakdown, setBreakdown] = useState<RatingBreakdownRow[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [myScore, setMyScore] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [commentBusy, setCommentBusy] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    setMissing(false)
    try {
      const found = await fetchPost(id)
      if (!found) {
        setMissing(true)
        return
      }
      setPost(found)
      const [rows, list] = await Promise.all([
        fetchRatingBreakdown(id),
        fetchComments(id),
      ])
      setBreakdown(rows)
      setComments(list)
      if (user?.id) {
        setMyScore(await fetchMyRating(id, user.id))
      } else {
        setMyScore(null)
      }
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [id, user?.id])

  useEffect(() => {
    void load()
  }, [load])

  async function postComment(event: React.FormEvent) {
    event.preventDefault()
    if (!user || !post) return
    const problem = validateComment(draft)
    if (problem) {
      setCommentError(problem)
      return
    }
    setCommentBusy(true)
    setCommentError(null)
    try {
      const created = await createComment(post.id, user.id, draft.trim())
      setComments((current) => [...current, created])
      setDraft('')
    } catch (err) {
      setCommentError(friendlyError(err))
    } finally {
      setCommentBusy(false)
    }
  }

  async function removeComment(commentId: string) {
    setCommentError(null)
    try {
      await deleteComment(commentId)
      setComments((current) => current.filter((c) => c.id !== commentId))
    } catch (err) {
      setCommentError(friendlyError(err))
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="mt-5 h-7 w-3/4" />
        <Skeleton className="mt-3 h-4 w-1/3" />
      </div>
    )
  }

  if (missing) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center md:px-6">
        <h1 className="text-xl font-bold">That post is not here</h1>
        <p className="mt-2 text-sm text-muted">It may have been removed.</p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover"
        >
          Back to the feed
        </Link>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center md:px-6">
        <p className="text-sm text-fg">{error ?? 'That post could not be loaded.'}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover"
        >
          Try again
        </button>
      </div>
    )
  }

  const maxCount = Math.max(1, ...breakdown.map((row) => row.count))
  const author = post.author

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5 md:px-6 md:py-6">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to the feed
      </Link>

      {post.image_url && (
        <div className="mb-5 overflow-hidden rounded-2xl bg-surface2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.image_url}
            alt=""
            width={1200}
            height={675}
            className="aspect-video w-full object-cover"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand">
          {post.category}
        </span>
        {post.is_demo && (
          <span className="rounded-md border border-line px-2 py-0.5 text-[11px] font-semibold text-muted">
            Demo
          </span>
        )}
        <span className="text-xs text-muted">{timeAgo(post.created_at)}</span>
      </div>

      <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight md:text-3xl">
        {post.title}
      </h1>

      {user && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {user.id === post.author_id ? (
            <>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="rounded-lg border border-line px-2.5 py-1.5 text-sm font-medium text-fg hover:bg-surface2"
              >
                Edit
              </button>
              {confirmDelete ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      setDeleting(true)
                      try {
                        await deletePost(post.id)
                        router.push('/')
                        router.refresh()
                      } catch {
                        setDeleting(false)
                        setConfirmDelete(false)
                      }
                    }}
                    disabled={deleting}
                    className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: 'var(--neg)' }}
                  >
                    {deleting ? 'Deleting…' : 'Confirm delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg border border-line px-2.5 py-1.5 text-sm font-medium hover:bg-surface2"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-lg border px-2.5 py-1.5 text-sm font-medium"
                  style={{ borderColor: 'color-mix(in srgb, var(--neg) 40%, transparent)', color: 'var(--neg)' }}
                >
                  Delete
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="rounded-lg border border-line px-2.5 py-1.5 text-sm font-medium text-muted hover:bg-surface2 hover:text-fg"
            >
              Report
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
        {author && (
          <span className="font-medium text-fg">@{author.username}</span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <MessageSquare size={14} aria-hidden="true" />
          {post.comment_count ?? comments.length}
        </span>
        {post.link_url && (
          <a
            href={post.link_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
          >
            Open link
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
      </div>

      {/* ---------------------------------------------------------- score */}
      <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Community rating
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span
                className="text-4xl font-bold tabular-nums"
                style={{
                  color:
                    post.rating_count === 0
                      ? 'var(--muted)'
                      : (post.rating_avg ?? 0) >= 1
                        ? 'var(--brand)'
                        : (post.rating_avg ?? 0) <= -1
                          ? 'var(--neg)'
                          : 'var(--fg)',
                }}
              >
                {formatAverage(post.rating_avg, post.rating_count)}
              </span>
              <span className="text-sm text-muted">out of +10</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              {post.rating_count === 0
                ? 'Not rated yet — be the first.'
                : `${post.rating_count} ${post.rating_count === 1 ? 'rating' : 'ratings'}`}
            </p>
          </div>
          <RatingChip avg={post.rating_avg} count={post.rating_count} size="md" />
        </div>

        {breakdown.length > 0 && (
          <div className="mt-5 flex flex-col gap-1.5" aria-label="Rating distribution">
            {breakdown
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((row) => (
                <div key={row.score} className="flex items-center gap-2 text-xs">
                  <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-muted">
                    {formatSigned(row.score)}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface2">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.round((row.count / maxCount) * 100)}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 tabular-nums text-muted">{row.count}</span>
                </div>
              ))}
          </div>
        )}
        <div className="mt-5 border-t border-line pt-4">
          <RatingControl
            postId={post.id}
            postAuthorId={post.author_id}
            avg={post.rating_avg}
            count={post.rating_count}
            myScore={myScore}
            onRated={(result) => {
              setMyScore(result.my_score)
              setPost((current) =>
                current
                  ? {
                      ...current,
                      rating_avg: result.rating_avg,
                      rating_count: result.rating_count,
                      rating_sum: result.rating_sum,
                    }
                  : current,
              )
            }}
          />
        </div>
      </section>

      {/* ----------------------------------------------------------- body */}
      <article className="mt-6 whitespace-pre-wrap text-[15px] leading-relaxed text-fg/90">
        {post.body}
      </article>

      {/* ------------------------------------------------------- comments */}
      <section className="mt-8">
        <h2 className="text-lg font-bold tracking-tight">
          Comments <span className="text-muted">({comments.length})</span>
        </h2>
        {user ? (
          <form onSubmit={postComment} className="mt-3 flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Add a comment…"
              aria-label="Write a comment"
              className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            {commentError && (
              <p role="alert" className="text-xs font-medium" style={{ color: 'var(--neg)' }}>
                {commentError}
              </p>
            )}
            <button
              type="submit"
              disabled={commentBusy || !draft.trim()}
              className="self-start rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50"
            >
              {commentBusy ? 'Posting…' : 'Post comment'}
            </button>
          </form>
        ) : (
          <p className="mt-3 rounded-xl border border-line bg-surface p-4 text-sm text-muted">
            <Link href="/login" className="font-semibold text-brand hover:underline">
              Sign in
            </Link>{' '}
            to join the conversation.
          </p>
        )}

        {comments.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line bg-surface/50 px-4 py-6 text-sm text-muted">
            No comments yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {comments.map((comment) => (
              <li key={comment.id} className="rounded-xl border border-line bg-surface p-4">
                <p className="text-sm font-semibold text-fg">
                  @{comment.author?.username ?? 'someone'}
                  <span className="ml-2 text-xs font-normal text-muted">
                    {timeAgo(comment.created_at)}
                  </span>
                  {user?.id === comment.author_id && (
                    <button
                      type="button"
                      onClick={() => void removeComment(comment.id)}
                      className="ml-2 text-xs font-medium text-muted hover:text-[color:var(--neg)]"
                    >
                      Delete
                    </button>
                  )}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-fg/90">{comment.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {editOpen && (
        <EditPostDialog
          post={post}
          userId={user?.id ?? ''}
          onClose={() => setEditOpen(false)}
          onSaved={(values: PostEditValues) =>
            setPost((current) =>
              current
                ? {
                    ...current,
                    title: values.title,
                    body: values.body,
                    category: values.category,
                    link_url: values.link_url.trim() || null,
                    image_url: values.image_url.trim() || null,
                  }
                : current,
            )
          }
        />
      )}

      {reportOpen && (
        <ReportDialog
          targetType="post"
          targetId={post.id}
          targetLabel={`“${post.title}”`}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  )
}
