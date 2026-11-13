import type { Category, ReportReason, SortMode } from './types'

export const CATEGORIES: Category[] = [
  'Meme',
  'Opinion',
  'Product',
  'Idea',
  'Question',
  'Other',
]

/** The rating scale is inclusive on both ends. */
export const RATING_MIN = -5
export const RATING_MAX = 10

export const SORTS: { value: SortMode; label: string; hint: string }[] = [
  { value: 'latest', label: 'Latest', hint: 'Newest posts first' },
  { value: 'trending', label: 'Trending', hint: 'Busy posts, weighted by recency' },
  { value: 'highest', label: 'Highest rated', hint: 'Best community average' },
  { value: 'lowest', label: 'Lowest rated', hint: 'Worst community average' },
  { value: 'controversial', label: 'Controversial', hint: 'Where opinions are most split' },
]

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam or repeated promotion' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'threats', label: 'Threats of violence' },
  { value: 'doxxing', label: 'Sharing private information' },
  { value: 'illegal', label: 'Illegal content' },
  { value: 'hate', label: 'Hate speech or targeted abuse' },
  { value: 'other', label: 'Something else' },
]

/** Length limits, mirrored by CHECK constraints in the database. */
export const LIMITS = {
  titleMin: 3,
  titleMax: 200,
  bodyMin: 1,
  bodyMax: 10000,
  commentMax: 2000,
  bioMax: 300,
  displayNameMax: 50,
  usernameMin: 3,
  usernameMax: 24,
  passwordMin: 8,
} as const

export const USERNAME_RE = /^[a-z0-9_]{3,24}$/

export const PAGE_SIZE = 20

/** Direct image uploads. Kept in step with the bucket in 0008_storage_media.sql. */
export const MEDIA_BUCKET = 'media'
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/avif'
export const IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
]
