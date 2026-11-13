-- =============================================================================
-- RateIt — 0004_api.sql
-- Read helpers the app calls directly: a sorted, filtered feed and a rating
-- distribution for a single post. Both run with the caller's rights, so RLS
-- still decides what they can see.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- list_posts — the home feed. Sorting happens in the database so that
-- "Trending" and "Controversial" are consistent for every client.
--   latest        — newest first
--   highest       — best community average first (unrated posts last)
--   lowest        — worst community average first (unrated posts last)
--   trending      — ratings weighted by recency
--   controversial — a strong split of positive and negative ratings
-- ---------------------------------------------------------------------------
create or replace function public.list_posts(
  p_sort     text    default 'latest',
  p_category text    default null,
  p_author   uuid    default null,
  p_limit    integer default 20,
  p_offset   integer default 0
)
returns table (
  id                 uuid,
  author_id          uuid,
  title              text,
  body               text,
  category           text,
  link_url           text,
  image_url          text,
  status             text,
  is_demo            boolean,
  rating_sum         integer,
  rating_count       integer,
  rating_avg         numeric,
  created_at         timestamptz,
  updated_at         timestamptz,
  author_username    text,
  author_display_name text,
  author_avatar_url  text,
  comment_count      bigint
)
language sql
stable
as $$
  select
    p.id,
    p.author_id,
    p.title,
    p.body,
    p.category,
    p.link_url,
    p.image_url,
    p.status,
    p.is_demo,
    p.rating_sum,
    p.rating_count,
    p.rating_avg,
    p.created_at,
    p.updated_at,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    (select count(*) from public.comments c
      where c.post_id = p.id and c.status = 'visible') as comment_count
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  left join lateral (
    select
      coalesce(stddev_samp(r.value), 0)::numeric          as sd,
      (count(*) filter (where r.value > 0))::numeric      as positives,
      (count(*) filter (where r.value < 0))::numeric      as negatives
    from public.ratings r
    where r.post_id = p.id
  ) rt on true
  where (p_category is null or p.category = p_category)
    and (p_author   is null or p.author_id = p_author)
  order by
    case when p_sort = 'highest' then p.rating_avg end desc nulls last,
    case when p_sort = 'lowest'  then p.rating_avg end asc  nulls last,
    case when p_sort = 'trending' then
      p.rating_count::numeric
        / power(extract(epoch from (now() - p.created_at)) / 3600.0 + 2.0, 1.5)
    end desc nulls last,
    case when p_sort = 'controversial' then
      least(rt.positives, rt.negatives) * 2.0 + rt.sd
    end desc nulls last,
    case when p_sort = 'latest' then extract(epoch from p.created_at) end desc nulls last,
    p.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- ---------------------------------------------------------------------------
-- get_rating_breakdown — how many people gave each value to a post
-- ---------------------------------------------------------------------------
create or replace function public.get_rating_breakdown(p_post_id uuid)
returns table (value smallint, count bigint)
language sql
stable
as $$
  select r.value, count(*)
  from public.ratings r
  where r.post_id = p_post_id
  group by r.value
  order by r.value;
$$;

-- ---------------------------------------------------------------------------
-- Feed statistics used by the "community pulse" strip on the home page.
-- ---------------------------------------------------------------------------
create or replace function public.get_community_stats()
returns table (total_posts bigint, total_ratings bigint, total_members bigint)
language sql
stable
as $$
  select
    (select count(*) from public.posts    where status = 'visible')::bigint,
    (select count(*) from public.ratings)::bigint,
    (select count(*) from public.profiles)::bigint;
$$;

-- ---------------------------------------------------------------------------
-- get_user_stats — numbers shown on a profile page
-- ---------------------------------------------------------------------------
create or replace function public.get_user_stats(p_user uuid)
returns table (
  posts_count      bigint,
  ratings_given    bigint,
  ratings_received bigint,
  avg_received     numeric
)
language sql
stable
as $$
  select
    (select count(*) from public.posts
      where author_id = p_user and status = 'visible')::bigint,
    (select count(*) from public.ratings
      where user_id = p_user)::bigint,
    (select count(*) from public.ratings r
      join public.posts p on p.id = r.post_id
      where p.author_id = p_user)::bigint,
    (select round(avg(r.value), 1) from public.ratings r
      join public.posts p on p.id = r.post_id
      where p.author_id = p_user);
$$;

grant execute on function
  public.list_posts(text, text, uuid, integer, integer),
  public.get_rating_breakdown(uuid),
  public.get_community_stats(),
  public.get_user_stats(uuid)
  to anon, authenticated;
