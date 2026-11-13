-- =============================================================================
-- RateIt — 0001_schema.sql
-- Core tables, foreign keys, constraints and indexes.
-- Target: PostgreSQL 15+ / Supabase.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles — public user data, 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null,
  display_name text,
  bio          text,
  avatar_url   text,
  role         text not null default 'user',
  is_banned    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint profiles_username_format
    check (username ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_role_valid
    check (role in ('user', 'moderator', 'admin')),
  constraint profiles_display_name_len
    check (display_name is null or char_length(display_name) between 1 and 50),
  constraint profiles_bio_len
    check (bio is null or char_length(bio) <= 300),
  constraint profiles_avatar_url_format
    check (avatar_url is null or avatar_url ~* '^https?://')
);

-- Usernames are unique case-insensitively, even though we store them lowercased.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- ---------------------------------------------------------------------------
-- posts — the things people post and rate
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  body         text not null,
  category     text not null,
  link_url     text,
  image_url    text,
  status       text not null default 'visible',
  is_demo      boolean not null default false,

  -- Aggregates are maintained by a database trigger (see 0002_functions.sql).
  -- They are never trusted from the client.
  rating_sum   integer not null default 0,
  rating_count integer not null default 0,
  rating_avg   numeric(4, 1) generated always as (
    case
      when rating_count > 0 then round(rating_sum::numeric / rating_count, 1)
      else null                     -- NULL means "no ratings yet", which is
    end                             -- deliberately different from an average of 0.
  ) stored,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint posts_title_len   check (char_length(title) between 3 and 200),
  constraint posts_body_len    check (char_length(body) between 1 and 10000),
  constraint posts_category_valid
    check (category in ('Meme', 'Opinion', 'Product', 'Idea', 'Question', 'Other')),
  constraint posts_status_valid
    check (status in ('visible', 'hidden', 'removed')),
  constraint posts_link_url_format
    check (link_url is null or link_url ~* '^https?://[^[:space:]]+$'),
  constraint posts_image_url_format
    check (image_url is null or image_url ~* '^https?://[^[:space:]]+$')
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_author_idx     on public.posts (author_id, created_at desc);
create index if not exists posts_category_idx   on public.posts (category);
create index if not exists posts_status_idx     on public.posts (status);
create index if not exists posts_rating_idx     on public.posts (rating_avg desc nulls last);

-- ---------------------------------------------------------------------------
-- ratings — one row per (user, post). Values are integers from -5 to +10.
-- ---------------------------------------------------------------------------
create table if not exists public.ratings (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  value      smallint not null,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ratings_value_range check (value between -5 and 10),

  -- The hard guarantee that an account can hold only one rating per post.
  constraint ratings_one_per_user_per_post unique (post_id, user_id)
);

create index if not exists ratings_post_idx on public.ratings (post_id);
create index if not exists ratings_user_idx on public.ratings (user_id);

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  parent_id  uuid references public.comments (id) on delete cascade,
  body       text not null,
  status     text not null default 'visible',
  is_demo    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint comments_body_len check (char_length(body) between 1 and 2000),
  constraint comments_status_valid check (status in ('visible', 'hidden', 'removed'))
);

create index if not exists comments_post_idx   on public.comments (post_id, created_at);
create index if not exists comments_author_idx on public.comments (author_id);

-- ---------------------------------------------------------------------------
-- reports — abuse reports against posts, comments and accounts
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null,
  target_id   uuid not null,
  reason      text not null,
  details     text,
  status      text not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,

  constraint reports_target_type_valid check (target_type in ('post', 'comment', 'user')),
  constraint reports_reason_valid
    check (reason in ('spam', 'harassment', 'threats', 'doxxing', 'illegal', 'hate', 'other')),
  constraint reports_status_valid
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  constraint reports_details_len check (details is null or char_length(details) <= 1000),

  -- One report per person per target, so the queue cannot be flooded.
  constraint reports_one_per_target unique (reporter_id, target_type, target_id)
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);

-- ---------------------------------------------------------------------------
-- blocks — a user hiding another user from their feed and interactions
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  id         uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint blocks_no_self check (blocker_id <> blocked_id),
  constraint blocks_unique  unique (blocker_id, blocked_id)
);

create index if not exists blocks_blocker_idx on public.blocks (blocker_id);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- ---------------------------------------------------------------------------
-- moderation_actions — an append-only audit trail for the moderator dashboard
-- ---------------------------------------------------------------------------
create table if not exists public.moderation_actions (
  id           uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references public.profiles (id) on delete cascade,
  action       text not null,
  target_type  text not null,
  target_id    uuid,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists moderation_actions_created_idx
  on public.moderation_actions (created_at desc);
