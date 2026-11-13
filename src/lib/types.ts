// Shared domain types for rabrate.

export type Category = 'Meme' | 'Opinion' | 'Product' | 'Idea' | 'Question' | 'Other'

export type SortMode = 'latest' | 'trending' | 'highest' | 'lowest' | 'controversial'

export type Role = 'user' | 'moderator' | 'admin'

export type ContentStatus = 'visible' | 'hidden' | 'removed'

export type ReportTarget = 'post' | 'comment' | 'user'

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'threats'
  | 'doxxing'
  | 'illegal'
  | 'hate'
  | 'other'

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'

export interface Profile {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  role: Role
  is_banned: boolean
  created_at: string
  updated_at: string
}

export interface AuthorSummary {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

export interface Post {
  id: string
  author_id: string
  title: string
  body: string
  category: Category
  link_url: string | null
  image_url: string | null
  status: ContentStatus
  is_demo: boolean
  rating_sum: number
  rating_count: number
  rating_avg: number | null
  created_at: string
  updated_at: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  comment_count: number
}

/** A post fetched with its embedded author (used on the detail page). */
export interface PostDetail
  extends Omit<
    Post,
    'author_username' | 'author_display_name' | 'author_avatar_url' | 'comment_count'
  > {
  author: AuthorSummary | null
  comment_count?: number
}

export interface Rating {
  id: string
  post_id: string
  user_id: string
  score: number
  created_at: string
  updated_at: string
}

/**
 * What the rate_post / remove_my_rating database functions return: the caller's
 * own saved score plus the freshly recomputed community aggregate.
 */
export interface RatingResult {
  id: string
  my_score: number | null
  rating_avg: number | null
  rating_count: number
  rating_sum: number
}

export interface Comment {
  id: string
  post_id: string
  author_id: string
  parent_id: string | null
  body: string
  status: ContentStatus
  is_demo: boolean
  created_at: string
  updated_at: string
  author: AuthorSummary | null
}

export interface Report {
  id: string
  reporter_id: string
  target_type: ReportTarget
  target_id: string
  reason: ReportReason
  details: string | null
  status: ReportStatus
  resolved_by: string | null
  created_at: string
  resolved_at: string | null
  reporter?: AuthorSummary | null
}

export interface Block {
  id: string
  blocker_id: string
  blocked_id: string
  created_at: string
}

export interface ModerationAction {
  id: string
  moderator_id: string
  action: string
  target_type: string
  target_id: string | null
  notes: string | null
  created_at: string
  moderator?: AuthorSummary | null
}

export interface RatingBreakdownRow {
  score: number
  count: number
}

export interface CommunityStats {
  total_posts: number
  total_ratings: number
  total_members: number
}
