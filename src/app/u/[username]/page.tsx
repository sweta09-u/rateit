'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  blockUser,
  fetchBlocks,
  fetchFeed,
  fetchProfileByUsername,
  fetchUserStats,
  unblockUser,
  type UserStats,
} from '@/lib/api'
import { friendlyError } from '@/lib/supabase'
import { formatAverage, formatDate, initials } from '@/lib/format'
import type { Post, Profile } from '@/lib/types'
import { PostCard } from '@/components/PostCard'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/context/AuthContext'

export default function ProfilePage() {
  const params = useParams<{ username: string }>()
  const username = params?.username
  const { user, profile: me } = useAuth()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [blockBusy, setBlockBusy] = useState(false)

  const load = useCallback(async () => {
    if (!username) return
    setLoading(true)
    setError(null)
    setMissing(false)
    try {
      const found = await fetchProfileByUsername(username)
      if (!found) {
        setMissing(true)
        return
      }
      setProfile(found)
      const [statsRow, rows] = await Promise.all([
        fetchUserStats(found.id),
        fetchFeed({ authorId: found.id, sort: 'latest', limit: 50 }),
      ])
      setStats(statsRow)
      setPosts(rows)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!user || !profile || user.id === profile.id) {
      setBlocked(false)
      return
    }
    let cancelled = false
    void fetchBlocks(user.id)
      .then((rows) => {
        if (!cancelled) setBlocked(rows.some((row) => row.blocked_id === profile.id))
      })
      .catch(() => setBlocked(false))
    return () => {
      cancelled = true
    }
  }, [user, profile])

  async function toggleBlock() {
    if (!user || !profile) return
    setBlockBusy(true)
    try {
      if (blocked) {
        await unblockUser(user.id, profile.id)
        setBlocked(false)
      } else {
        await blockUser(user.id, profile.id)
        setBlocked(true)
      }
    } catch {
      /* leave the button as it was */
    } finally {
      setBlockBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6">
        <div className="h-28 animate-pulse rounded-2xl bg-surface" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (missing) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center md:px-6">
        <h1 className="text-xl font-bold">No such profile</h1>
        <p className="mt-2 text-sm text-muted">Nobody here goes by @{username}.</p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover"
        >
          Back to the feed
        </Link>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center md:px-6">
        <p className="text-sm text-fg">{error ?? 'That profile could not be loaded.'}</p>
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

  const display = profile.display_name || profile.username
  const isOwn = me?.id === profile.id

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-5 md:px-6 md:py-6">
      <header className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="h-20 bg-gradient-to-r from-brand/25 via-brand/10 to-transparent" />
        <div className="px-5 pb-5">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-surface bg-brand text-xl font-bold text-brand-fg">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials(display)
                )}
              </div>
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight">{display}</h1>
                  {(profile.role === 'moderator' || profile.role === 'admin') && (
                    <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                      {profile.role}
                    </span>
                  )}
                  {profile.is_banned && (
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase"
                      style={{ background: 'color-mix(in srgb, var(--neg) 15%, transparent)', color: 'var(--neg)' }}
                    >
                      Suspended
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted">@{profile.username}</p>
              </div>
            </div>
            {isOwn ? (
              <Link
                href="/settings"
                className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-fg hover:bg-surface2"
              >
                Edit profile
              </Link>
            ) : (
              me && (
                <button
                  type="button"
                  onClick={() => void toggleBlock()}
                  disabled={blockBusy}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface2 hover:text-fg disabled:opacity-60"
                >
                  {blockBusy ? '…' : blocked ? 'Unblock' : 'Block'}
                </button>
              )
            )}
          </div>

          {profile.bio && <p className="mt-3 text-sm text-fg/90">{profile.bio}</p>}
          <p className="mt-2 text-xs text-muted">Joined {formatDate(profile.created_at)}</p>
        </div>
      </header>

      {stats && (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Posts', String(stats.posts_count)],
            ['Ratings given', String(stats.ratings_given)],
            ['Ratings received', String(stats.ratings_received)],
            ['Average received', formatAverage(stats.avg_received, stats.ratings_received)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-line bg-surface px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <h2 className="mt-8 text-lg font-bold tracking-tight">
        {isOwn ? 'Your posts' : `Posts by ${display}`}
      </h2>

      {posts.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line bg-surface/50 px-4 py-8 text-center text-sm text-muted">
          {isOwn ? 'You have not posted anything yet.' : 'Nothing published yet.'}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
