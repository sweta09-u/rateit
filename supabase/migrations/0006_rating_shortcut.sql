-- =============================================================================
-- RateIt — 0006_rating_shortcut.sql
--
-- Supports the inline rating shortcut and the "+10" quick action.
--
--   1. Renames ratings.value -> score, to match the documented rating contract
--      (id, post_id, user_id, score, created_at, updated_at). Existing rows are
--      preserved by the rename.
--   2. Adds rate_post() — one atomic upsert that writes the signed-in user's
--      rating and returns the saved score plus the refreshed aggregate. The
--      caller never supplies a user id; it comes from the JWT via auth.uid().
--   3. Adds remove_my_rating().
--   4. Adds a search term to list_posts().
--
-- Existing migrations are left untouched so the history stays honest; this file
-- brings the database to the same shape whether it is applied on top of the
-- current project or run in order on a fresh one.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. value -> score
-- ---------------------------------------------------------------------------
alter table public.ratings rename column value to score;
alter table public.ratings rename constraint ratings_value_range to ratings_score_range;

-- ---------------------------------------------------------------------------
-- 2. Recreate the functions whose bodies referenced the old column name.
--    (A plpgsql/sql body is stored as text and resolved at run time, so the
--    rename alone would leave them broken.)
-- ---------------------------------------------------------------------------
create or replace function public.recalc_post_ratings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ids        uuid[];
  target_id  uuid;
begin
  if tg_op = 'DELETE' then
    ids := array[old.post_id];
  elsif tg_op = 'UPDATE' then
    ids := array[new.post_id, old.post_id];
  else
    ids := array[new.post_id];
  end if;

  ids := (select array_agg(distinct x) from unnest(ids) as x);

  perform set_config('simple.bypass_protect', 'on', true);

  foreach target_id in array ids loop
    update public.posts p
       set rating_sum = coalesce(
             (select sum(score) from public.ratings where post_id = target_id), 0
           )::integer,
           rating_count = coalesce(
             (select count(*) from public.ratings where post_id = target_id), 0
           )::integer
     where p.id = target_id;
  end loop;

  perform set_config('simple.bypass_protect', 'off', true);
  return null;
end;
$$;

-- The output column is renamed, which changes the function's return type;
-- CREATE OR REPLACE cannot do that, so drop it first.
drop function if exists public.get_rating_breakdown(uuid);

create or replace function public.get_rating_breakdown(p_post_id uuid)
returns table (score smallint, count bigint)
language sql
stable
set search_path = public
as $$
  select r.score, count(*)
  from public.ratings r
  where r.post_id = p_post_id
  group by r.score
  order by r.score;
$$;

-- ---------------------------------------------------------------------------
-- 3. list_posts — same sorts, plus a search term.
--    The parameter list changes, so the old signature is dropped first;
--    CREATE OR REPLACE would otherwise leave an ambiguous overload behind.
-- ---------------------------------------------------------------------------
drop function if exists public.list_posts(text, text, uuid, integer, integer);

create or replace function public.list_posts(
  p_sort     text    default 'latest',
  p_category text    default null,
  p_author   uuid    default null,
  p_search   text    default null,
  p_limit    integer default 20,
  p_offset   integer default 0
)
returns table (
  id                  uuid,
  author_id           uuid,
  title               text,
  body                text,
  category            text,
  link_url            text,
  image_url           text,
  status              text,
  is_demo             boolean,
  rating_sum          integer,
  rating_count        integer,
  rating_avg          numeric,
  created_at          timestamptz,
  updated_at          timestamptz,
  author_username     text,
  author_display_name text,
  author_avatar_url   text,
  comment_count       bigint
)
language sql
stable
set search_path = public
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
      coalesce(stddev_samp(r.score), 0)::numeric          as sd,
      (count(*) filter (where r.score > 0))::numeric      as positives,
      (count(*) filter (where r.score < 0))::numeric      as negatives
    from public.ratings r
    where r.post_id = p.id
  ) rt on true
  where (p_category is null or p.category = p_category)
    and (p_author   is null or p.author_id = p_author)
    -- Plain substring match: no LIKE wildcards to escape, case-insensitive.
    and (
      p_search is null
      or btrim(p_search) = ''
      or position(lower(btrim(p_search)) in lower(p.title)) > 0
      or position(lower(btrim(p_search)) in lower(p.body)) > 0
    )
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
-- 4. rate_post — the single write path used by the rating shortcut.
--
--    SECURITY INVOKER on purpose: every statement inside runs with the caller's
--    rights, so the Row Level Security policies on ratings still apply. This is
--    belt and braces — the insert policy independently enforces that user_id is
--    the caller, the post is visible, and no block sits between the two people,
--    while the trigger blocks self-rating and the check constraint blocks
--    out-of-range scores.
--
--    Returns the saved score and the refreshed aggregate in one round trip, so
--    the interface never has to guess or refetch.
-- ---------------------------------------------------------------------------
create or replace function public.rate_post(
  p_post_id uuid,
  p_score   integer
)
returns table (
  id           uuid,
  my_score     smallint,
  rating_avg   numeric,
  rating_count integer,
  rating_sum   integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'You must be signed in to rate a post.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_score is null or p_score < -5 or p_score > 10 then
    raise exception 'A rating must be a whole number from -5 to 10.'
      using errcode = 'check_violation';
  end if;

  -- Atomic upsert: insert the first rating, or overwrite the existing one.
  -- The unique constraint on (post_id, user_id) makes a duplicate impossible.
  insert into public.ratings (post_id, user_id, score)
  values (p_post_id, uid, p_score)
  on conflict (post_id, user_id) do update
    set score      = excluded.score,
        updated_at = now();

  return query
    select p.id, r.score, p.rating_avg, p.rating_count, p.rating_sum
    from public.posts p
    left join public.ratings r
           on r.post_id = p.id and r.user_id = uid
    where p.id = p_post_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. remove_my_rating — clears the caller's rating and returns the aggregate.
-- ---------------------------------------------------------------------------
create or replace function public.remove_my_rating(p_post_id uuid)
returns table (
  id           uuid,
  my_score     smallint,
  rating_avg   numeric,
  rating_count integer,
  rating_sum   integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'You must be signed in to rate a post.'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.ratings r
   where r.post_id = p_post_id and r.user_id = uid;

  return query
    select p.id, r.score, p.rating_avg, p.rating_count, p.rating_sum
    from public.posts p
    left join public.ratings r
           on r.post_id = p.id and r.user_id = uid
    where p.id = p_post_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Permissions. Rating is for signed-in accounts only, so anon is revoked.
-- ---------------------------------------------------------------------------
grant execute on function public.list_posts(text, text, uuid, text, integer, integer)
  to anon, authenticated;
grant execute on function public.get_rating_breakdown(uuid) to anon, authenticated;

grant execute on function public.rate_post(uuid, integer) to authenticated;
grant execute on function public.remove_my_rating(uuid)   to authenticated;

revoke execute on function public.rate_post(uuid, integer) from public, anon;
revoke execute on function public.remove_my_rating(uuid)   from public, anon;
