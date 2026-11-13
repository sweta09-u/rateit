'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { fetchFeed } from '@/lib/api'
import { friendlyError } from '@/lib/supabase'
import type { Category, Post, SortMode } from '@/lib/types'
import { PostCard } from './PostCard'
import { CardSkeleton } from './ui/Skeleton'

/**
 * One horizontal band of the feed. Everything it shows comes from the real
 * `list_posts` database function — the heading names the sort that produced it,
 * so nothing is presented as something it is not.
 */
export function FeedSection({
  title,
  subtitle,
  sort = 'latest',
  category = null,
  search = null,
  limit = 8,
  columns = 'grid',
  showRank = false,
  seeAllHref,
}: {
  title: string
  subtitle?: string
  sort?: SortMode
  category?: Category | null
  search?: string | null
  limit?: number
  columns?: 'grid' | 'hero'
  showRank?: boolean
  seeAllHref?: string
}) {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const load = useCallback(async () => {
    setError(null)
    setPosts(null)
    try {
      setPosts(await fetchFeed({ sort, category, search, limit }))
    } catch (err) {
      setError(friendlyError(err))
    }
  }, [sort, category, search, limit])

  useEffect(() => {
    void load()
  }, [load, attempt])

  const gridClass =
    columns === 'hero'
      ? 'grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3'
      : 'grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-fg md:text-xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-muted hover:bg-surface hover:text-fg"
          >
            View all
          </Link>
        )}
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-center gap-2 text-sm text-fg">
            <AlertCircle size={16} className="text-[color:var(--neg)]" aria-hidden="true" />
            {error}
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover"
          >
            Try again
          </button>
        </div>
      ) : posts === null ? (
        <div className={gridClass}>
          {Array.from({ length: columns === 'hero' ? 3 : 4 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface/50 px-5 py-10 text-center">
          <p className="text-sm font-medium text-fg">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted">
            {search
              ? `No posts match “${search}”.`
              : 'Once someone posts in this category it will show up here.'}
          </p>
          <Link
            href="/new"
            className="mt-4 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover"
          >
            Write the first one
          </Link>
        </div>
      ) : (
        <div className={gridClass}>
          {posts.map((post, index) => (
            <PostCard key={post.id} post={post} rank={showRank ? index + 1 : undefined} />
          ))}
        </div>
      )}
    </section>
  )
}
