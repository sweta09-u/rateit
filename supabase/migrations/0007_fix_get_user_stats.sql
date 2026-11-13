-- =============================================================================
-- RateIt — 0007_fix_get_user_stats.sql
--
-- 0006 renamed ratings.value -> score and recreated the functions that
-- referenced the old name — but it missed get_user_stats(). Its body still read
-- `r.value`, so every call failed with "column r.value does not exist", which
-- broke the statistics block on every profile page.
--
-- Found by an integration test that called the function over HTTP rather than
-- trusting that the rename was complete. A catalog scan confirmed this was the
-- only object left behind.
-- =============================================================================

create or replace function public.get_user_stats(p_user uuid)
returns table (
  posts_count      bigint,
  ratings_given    bigint,
  ratings_received bigint,
  avg_received     numeric
)
language sql
stable
set search_path = public
as $$
  select
    (select count(*) from public.posts
      where author_id = p_user and status = 'visible')::bigint,
    (select count(*) from public.ratings
      where user_id = p_user)::bigint,
    (select count(*) from public.ratings r
      join public.posts p on p.id = r.post_id
      where p.author_id = p_user)::bigint,
    (select round(avg(r.score), 1) from public.ratings r
      join public.posts p on p.id = r.post_id
      where p.author_id = p_user);
$$;

grant execute on function public.get_user_stats(uuid) to anon, authenticated;
