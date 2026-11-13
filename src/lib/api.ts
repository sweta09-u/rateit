import { supabase, friendlyError } from './supabase'
import { IMAGE_MAX_BYTES, IMAGE_TYPES, MEDIA_BUCKET, PAGE_SIZE } from './constants'
import type {
  Block,
  Category,
  Comment,
  CommunityStats,
  ContentStatus,
  ModerationAction,
  Post,
  PostDetail,
  Profile,
  RatingBreakdownRow,
  RatingResult,
  Report,
  ReportReason,
  ReportStatus,
  ReportTarget,
  SortMode,
} from './types'

function fail(error: unknown): never {
  throw new Error(friendlyError(error))
}

/* -------------------------------------------------------------------------- */
/* Feed & posts                                                               */
/* -------------------------------------------------------------------------- */

export interface FeedQuery {
  sort?: SortMode
  category?: Category | null
  authorId?: string | null
  search?: string | null
  limit?: number
  offset?: number
}

/**
 * The feed is produced by a database function, so "Trending" and
 * "Controversial" are computed consistently for everyone, and RLS still
 * decides which rows come back.
 */
export async function fetchFeed(query: FeedQuery = {}): Promise<Post[]> {
  const { data, error } = await supabase.rpc('list_posts', {
    p_sort: query.sort ?? 'latest',
    p_category: query.category ?? null,
    p_author: query.authorId ?? null,
    p_search: query.search?.trim() || null,
    p_limit: query.limit ?? PAGE_SIZE,
    p_offset: query.offset ?? 0,
  })
  if (error) fail(error)
  return (data ?? []) as Post[]
}

export async function fetchPost(id: string): Promise<PostDetail | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(
      '*, author:profiles!posts_author_id_fkey(id,username,display_name,avatar_url)',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) fail(error)
  if (!data) return null

  const { count } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', id)

  return { ...(data as PostDetail), comment_count: count ?? 0 }
}

export interface NewPost {
  title: string
  body: string
  category: Category
  link_url?: string | null
  image_url?: string | null
}

export async function createPost(input: NewPost): Promise<Post> {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user) throw new Error('You need to be signed in to publish.')

  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: user.id,
      title: input.title.trim(),
      body: input.body.trim(),
      category: input.category,
      link_url: input.link_url?.trim() || null,
      image_url: input.image_url?.trim() || null,
    })
    .select('*')
    .single()

  if (error) fail(error)
  return data as Post
}

export async function updatePost(
  id: string,
  input: Partial<NewPost>,
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.title !== undefined) patch.title = input.title.trim()
  if (input.body !== undefined) patch.body = input.body.trim()
  if (input.category !== undefined) patch.category = input.category
  if (input.link_url !== undefined) patch.link_url = input.link_url?.trim() || null
  if (input.image_url !== undefined) patch.image_url = input.image_url?.trim() || null

  const { error } = await supabase.from('posts').update(patch).eq('id', id)
  if (error) fail(error)
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) fail(error)
}

/* -------------------------------------------------------------------------- */
/* Ratings                                                                    */
/* -------------------------------------------------------------------------- */

export async function fetchMyRating(
  postId: string,
  userId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('ratings')
    .select('score')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) fail(error)
  return data ? (data as { score: number }).score : null
}

/**
 * Save this user's rating through the rate_post database function.
 *
 * The function performs one atomic upsert keyed on (post_id, user_id) — so
 * re-rating updates the existing row rather than adding a duplicate — takes the
 * user id from the JWT rather than the caller, and returns the refreshed
 * community aggregate so the interface never has to guess.
 */
export async function ratePost(
  postId: string,
  score: number,
): Promise<RatingResult> {
  const { data, error } = await supabase.rpc('rate_post', {
    p_post_id: postId,
    p_score: score,
  })
  if (error) fail(error)
  const rows = (data ?? []) as RatingResult[]
  if (!rows[0]) throw new Error('The rating could not be saved.')
  return rows[0]
}

/** Clear this user's rating and get the refreshed aggregate back. */
export async function removeMyRating(postId: string): Promise<RatingResult> {
  const { data, error } = await supabase.rpc('remove_my_rating', {
    p_post_id: postId,
  })
  if (error) fail(error)
  const rows = (data ?? []) as RatingResult[]
  if (!rows[0]) throw new Error('The rating could not be removed.')
  return rows[0]
}

/**
 * One round trip to find this user's rating on every post in the feed, so each
 * card can show "your rating" without a query per post.
 */
export async function fetchMyRatings(
  postIds: string[],
  userId: string,
): Promise<Record<string, number>> {
  if (postIds.length === 0) return {}
  const { data, error } = await supabase
    .from('ratings')
    .select('post_id, score')
    .eq('user_id', userId)
    .in('post_id', postIds)
  if (error) fail(error)
  const map: Record<string, number> = {}
  for (const row of (data ?? []) as { post_id: string; score: number }[]) {
    map[row.post_id] = row.score
  }
  return map
}

export async function fetchRatingBreakdown(
  postId: string,
): Promise<RatingBreakdownRow[]> {
  const { data, error } = await supabase.rpc('get_rating_breakdown', {
    p_post_id: postId,
  })
  if (error) fail(error)
  return (data ?? []) as RatingBreakdownRow[]
}

/**
 * Media can live in either place. Supabase Storage stays the default so nothing
 * changes until Neon is provisioned; set VITE_MEDIA_PROVIDER=neon to switch.
 */
const MEDIA_PROVIDER = process.env.NEXT_PUBLIC_MEDIA_PROVIDER === 'neon' ? 'neon' : 'supabase'
const PRESIGN_URL = process.env.NEXT_PUBLIC_MEDIA_PRESIGN_URL || '/api/media/presign'

/**
 * Upload to Neon object storage through a presigned URL.
 *
 * The browser never sees storage credentials: it asks our own endpoint for a
 * short-lived PUT, then uploads straight to the bucket. The key is built server
 * side from the verified user id, so the folder is not client-controlled.
 */
async function uploadToNeon(file: File, kind: 'posts' | 'avatars'): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('You need to be signed in to upload an image.')

  const prepared = await fetch(PRESIGN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ kind, contentType: file.type }),
  })
  if (!prepared.ok) {
    const detail = (await prepared.json().catch(() => null)) as { error?: string } | null
    throw new Error(detail?.error || 'The upload could not be prepared.')
  }
  const { uploadUrl, publicUrl } = (await prepared.json()) as {
    uploadUrl: string
    publicUrl: string
  }

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!put.ok) throw new Error('The image could not be uploaded to storage.')
  return publicUrl
}

/**
 * Upload an image straight from the user's device.
 *
 * Objects always land in `<user-id>/<kind>/<random>.<ext>` — a folder named
 * after the uploader — so the browser cannot write into anyone else's folder
 * even if it tried to. Returns the public URL to store on the post or profile.
 *
 * Supabase Storage enforces that with its storage policies; the Neon path
 * enforces it in api/media/presign.ts, which builds the key from the verified
 * session rather than from anything the client sends.
 */
export async function uploadImage(
  file: File,
  userId: string,
  kind: 'posts' | 'avatars',
): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) {
    throw new Error('That file type is not supported. Use a PNG, JPEG, WebP, GIF or AVIF.')
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error(
      `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${Math.round(
        IMAGE_MAX_BYTES / 1024 / 1024,
      )} MB.`,
    )
  }

  if (MEDIA_PROVIDER === 'neon') return uploadToNeon(file, kind)

  const ext = (file.name.split('.').pop() || 'png')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 5) || 'png'
  const path = `${userId}/${kind}/${randomId()}.${ext}`

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type,
  })
  if (error) fail(error)

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('The upload succeeded but no URL came back.')
  return data.publicUrl
}

/** randomUUID needs a secure context; fall back when the app is served over http. */
function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export async function fetchCommunityStats(): Promise<CommunityStats | null> {
  const { data, error } = await supabase.rpc('get_community_stats')
  if (error) fail(error)
  const rows = (data ?? []) as CommunityStats[]
  return rows[0] ?? null
}

/* -------------------------------------------------------------------------- */
/* Comments                                                                   */
/* -------------------------------------------------------------------------- */

const COMMENT_SELECT =
  '*, author:profiles!comments_author_id_fkey(id,username,display_name,avatar_url)'

export async function fetchComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(COMMENT_SELECT)
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  if (error) fail(error)
  return (data ?? []) as unknown as Comment[]
}

export async function createComment(
  postId: string,
  authorId: string,
  body: string,
): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, author_id: authorId, body: body.trim() })
    .select(COMMENT_SELECT)
    .single()
  if (error) fail(error)
  return data as unknown as Comment
}

export async function updateComment(id: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .update({ body: body.trim() })
    .eq('id', id)
  if (error) fail(error)
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', id)
  if (error) fail(error)
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                    */
/* -------------------------------------------------------------------------- */

export async function submitReport(input: {
  reporterId: string
  targetType: ReportTarget
  targetId: string
  reason: ReportReason
  details?: string | null
}): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    reporter_id: input.reporterId,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details: input.details?.trim() || null,
  })
  if (error) fail(error)
}

export async function fetchReports(): Promise<Report[]> {
  const { data, error } = await supabase
    .from('reports')
    .select(
      '*, reporter:profiles!reports_reporter_id_fkey(id,username,display_name,avatar_url)',
    )
    .order('created_at', { ascending: false })
  if (error) fail(error)
  return (data ?? []) as unknown as Report[]
}

export async function updateReportStatus(
  id: string,
  status: ReportStatus,
  resolvedBy: string,
): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .update({
      status,
      resolved_by: status === 'resolved' || status === 'dismissed' ? resolvedBy : null,
      resolved_at:
        status === 'resolved' || status === 'dismissed'
          ? new Date().toISOString()
          : null,
    })
    .eq('id', id)
  if (error) fail(error)
}

/* -------------------------------------------------------------------------- */
/* Moderation                                                                 */
/* -------------------------------------------------------------------------- */

export async function setPostStatus(
  id: string,
  status: ContentStatus,
): Promise<void> {
  const { error } = await supabase.from('posts').update({ status }).eq('id', id)
  if (error) fail(error)
}

export async function setCommentStatus(
  id: string,
  status: ContentStatus,
): Promise<void> {
  const { error } = await supabase.from('comments').update({ status }).eq('id', id)
  if (error) fail(error)
}

export async function setUserBanned(id: string, isBanned: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_banned: isBanned })
    .eq('id', id)
  if (error) fail(error)
}

export async function logModerationAction(input: {
  action: string
  targetType: string
  targetId: string | null
  notes?: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('log_moderation_action', {
    p_action: input.action,
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_notes: input.notes ?? null,
  })
  if (error) fail(error)
}

export async function fetchModerationActions(): Promise<ModerationAction[]> {
  const { data, error } = await supabase
    .from('moderation_actions')
    .select(
      '*, moderator:profiles!moderation_actions_moderator_id_fkey(id,username,display_name,avatar_url)',
    )
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) fail(error)
  return (data ?? []) as unknown as ModerationAction[]
}

/* -------------------------------------------------------------------------- */
/* Profiles                                                                   */
/* -------------------------------------------------------------------------- */

export async function fetchProfileById(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) fail(error)
  return (data as Profile) ?? null
}

export async function fetchProfileByUsername(
  username: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username.toLowerCase())
    .maybeSingle()
  if (error) fail(error)
  return (data as Profile) ?? null
}

export async function fetchProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('profiles').select('*').in('id', ids)
  if (error) fail(error)
  return (data ?? []) as Profile[]
}

/** Used by the moderation dashboard to link a comment back to its post. */
export async function fetchCommentTarget(
  id: string,
): Promise<{ id: string; post_id: string; body: string; status: ContentStatus } | null> {
  const { data, error } = await supabase
    .from('comments')
    .select('id, post_id, body, status')
    .eq('id', id)
    .maybeSingle()
  if (error) fail(error)
  return data ?? null
}

export async function updateProfile(
  id: string,
  patch: Partial<Pick<Profile, 'display_name' | 'bio' | 'avatar_url'>>,
): Promise<void> {
  const clean: Record<string, unknown> = {}
  if (patch.display_name !== undefined) clean.display_name = patch.display_name?.trim() || null
  if (patch.bio !== undefined) clean.bio = patch.bio?.trim() || null
  if (patch.avatar_url !== undefined) clean.avatar_url = patch.avatar_url?.trim() || null

  const { error } = await supabase.from('profiles').update(clean).eq('id', id)
  if (error) fail(error)
}

export interface UserStats {
  posts_count: number
  ratings_given: number
  ratings_received: number
  avg_received: number | null
}

export async function fetchUserStats(userId: string): Promise<UserStats | null> {
  const { data, error } = await supabase.rpc('get_user_stats', { p_user: userId })
  if (error) fail(error)
  const rows = (data ?? []) as UserStats[]
  return rows[0] ?? null
}

/** Erase the signed-in account and all of its personal data. */
export async function deleteOwnAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_own_account')
  if (error) fail(error)
  await supabase.auth.signOut()
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                     */
/* -------------------------------------------------------------------------- */

export async function fetchBlocks(blockerId: string): Promise<Block[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select('*')
    .eq('blocker_id', blockerId)
  if (error) fail(error)
  return (data ?? []) as Block[]
}

export async function blockUser(
  blockerId: string,
  blockedId: string,
): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: blockerId, blocked_id: blockedId })
  if (error) fail(error)
}

export async function unblockUser(
  blockerId: string,
  blockedId: string,
): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
  if (error) fail(error)
}
