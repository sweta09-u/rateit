'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { MessageSquare } from 'lucide-react'
import type { Post } from '@/lib/types'
import { timeAgo } from '@/lib/format'
import { RatingChip } from './RatingChip'

/**
 * A feed card. Uses a plain <img> with explicit dimensions and lazy loading:
 * image hosts vary by deployment (Supabase, R2, or a custom bucket domain), and
 * a fixed 16:9 box keeps layout stable whatever loads.
 */
export function PostCard({ post, rank }: { post: Post; rank?: number }) {
  return (
    <motion.article
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="group relative flex flex-col"
    >
      <Link href={`/post/${post.id}`} className="flex flex-col gap-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-surface2">
          {post.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.image_url}
              alt=""
              loading="lazy"
              decoding="async"
              width={640}
              height={360}
              className="h-full w-full object-cover transition-transform duration-300 ease-smooth group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface2 to-surface"
              aria-hidden="true"
            >
              <span className="text-3xl font-bold text-muted/25">{post.category}</span>
            </div>
          )}

          {typeof rank === 'number' && (
            <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-bg/85 text-sm font-bold tabular-nums text-fg backdrop-blur">
              {rank}
            </span>
          )}

          <span className="absolute bottom-2 left-2 rounded-md bg-bg/85 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fg backdrop-blur">
            {post.category}
          </span>

          <span className="absolute bottom-2 right-2 rounded-md bg-bg/85 px-1.5 py-0.5 backdrop-blur">
            <RatingChip avg={post.rating_avg} count={post.rating_count} />
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <h3 className="line-2 text-[15px] font-semibold leading-snug text-fg">{post.title}</h3>
          <p className="flex items-center gap-2 text-xs text-muted">
            <span className="truncate">@{post.author_username}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{timeAgo(post.created_at)}</span>
            {post.comment_count > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex shrink-0 items-center gap-1">
                  <MessageSquare size={12} aria-hidden="true" />
                  {post.comment_count}
                </span>
              </>
            )}
          </p>
        </div>
      </Link>
    </motion.article>
  )
}
