-- =============================================================================
-- RateIt — 0002_functions.sql
-- Database-side logic: authorisation helpers, rating aggregation, integrity
-- guards, rate limiting and account deletion.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- set_updated_at — keep updated_at honest on every table that has one
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

drop trigger if exists ratings_set_updated_at on public.ratings;
create trigger ratings_set_updated_at
  before update on public.ratings
  for each row execute function public.set_updated_at();

drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- is_moderator — SECURITY DEFINER so RLS policies can ask this question
-- without recursing back into the profiles policy.
-- ---------------------------------------------------------------------------
create or replace function public.is_moderator(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid
      and role in ('moderator', 'admin')
      and is_banned = false
  );
$$;

-- ---------------------------------------------------------------------------
-- is_blocked_between — true if either user has blocked the other
-- ---------------------------------------------------------------------------
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

-- ---------------------------------------------------------------------------
-- handle_new_user — create a profile automatically on signup, deriving a
-- unique public username from the metadata the client passed.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username  text;
  final_username text;
  suffix         integer := 0;
begin
  base_username := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  base_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');

  if char_length(base_username) < 3 then
    base_username := 'user' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  base_username := substr(base_username, 1, 20);

  final_username := base_username;
  while exists (select 1 from public.profiles p where lower(p.username) = final_username) loop
    suffix := suffix + 1;
    final_username := substr(base_username, 1, 20) || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    final_username,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), final_username)
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- recalc_post_ratings — recompute a post's aggregate whenever its ratings
-- change. This is the only writer of rating_sum / rating_count, so community
-- averages can never be supplied by a client.
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

  -- de-duplicate (an UPDATE that does not move the post yields the id twice)
  ids := (select array_agg(distinct x) from unnest(ids) as x);

  -- Let the guard trigger know this write is legitimate bookkeeping.
  perform set_config('simple.bypass_protect', 'on', true);

  foreach target_id in array ids loop
    update public.posts p
       set rating_sum = coalesce(
             (select sum(value) from public.ratings where post_id = target_id), 0
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

drop trigger if exists ratings_aggregate on public.ratings;
create trigger ratings_aggregate
  after insert or update or delete on public.ratings
  for each row execute function public.recalc_post_ratings();

-- ---------------------------------------------------------------------------
-- prevent_self_rating — you may not rate your own post
-- ---------------------------------------------------------------------------
create or replace function public.prevent_self_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.posts p
    where p.id = new.post_id and p.author_id = new.user_id
  ) then
    raise exception 'You cannot rate your own post.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists ratings_no_self on public.ratings;
create trigger ratings_no_self
  before insert or update on public.ratings
  for each row execute function public.prevent_self_rating();

-- ---------------------------------------------------------------------------
-- protect_post_columns — authors may edit their content, but may never
-- rewrite ownership, moderation status, or the rating aggregates.
-- ---------------------------------------------------------------------------
create or replace function public.protect_post_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trusted server context (service role / SQL editor) and bookkeeping
  -- writes from recalc_post_ratings are allowed through untouched.
  if auth.uid() is null
     or coalesce(current_setting('simple.bypass_protect', true), 'off') = 'on'
     or public.is_moderator(auth.uid()) then
    return new;
  end if;

  new.author_id    := old.author_id;
  new.status       := old.status;
  new.is_demo      := old.is_demo;
  new.rating_sum   := old.rating_sum;
  new.rating_count := old.rating_count;
  return new;
end;
$$;

drop trigger if exists posts_protect on public.posts;
create trigger posts_protect
  before update on public.posts
  for each row execute function public.protect_post_columns();

-- ---------------------------------------------------------------------------
-- protect_comment_columns — same idea for comments
-- ---------------------------------------------------------------------------
create or replace function public.protect_comment_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_moderator(auth.uid()) then
    return new;
  end if;

  new.author_id := old.author_id;
  new.post_id   := old.post_id;
  new.status    := old.status;
  new.is_demo   := old.is_demo;
  return new;
end;
$$;

drop trigger if exists comments_protect on public.comments;
create trigger comments_protect
  before update on public.comments
  for each row execute function public.protect_comment_columns();

-- ---------------------------------------------------------------------------
-- protect_profile_columns — a user may edit their own bio and handle, but
-- only a moderator may grant roles or ban accounts.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_moderator(auth.uid()) then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.is_banned is distinct from old.is_banned
     or new.id is distinct from old.id then
    raise exception 'Only moderators may change a role or ban status.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- enforce_rate_limit — a light server-side throttle on posts and comments
-- so a single account cannot flood the feed.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent integer;
begin
  if auth.uid() is null then
    return new;   -- trusted server context, e.g. seeding
  end if;

  if tg_table_name = 'posts' then
    select count(*) into recent
      from public.posts
     where author_id = new.author_id
       and created_at > now() - interval '60 seconds';
    if recent >= 5 then
      raise exception 'Slow down — you can post at most 5 times per minute.'
        using errcode = 'check_violation';
    end if;
  elsif tg_table_name = 'comments' then
    select count(*) into recent
      from public.comments
     where author_id = new.author_id
       and created_at > now() - interval '60 seconds';
    if recent >= 15 then
      raise exception 'Slow down — you can comment at most 15 times per minute.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists posts_rate_limit on public.posts;
create trigger posts_rate_limit
  before insert on public.posts
  for each row execute function public.enforce_rate_limit();

drop trigger if exists comments_rate_limit on public.comments;
create trigger comments_rate_limit
  before insert on public.comments
  for each row execute function public.enforce_rate_limit();

-- ---------------------------------------------------------------------------
-- delete_own_account — lets a signed-in user erase their account and all
-- associated personal data. SECURITY DEFINER so the cascade can reach
-- auth.users, which the browser role cannot touch directly.
-- ---------------------------------------------------------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'You must be signed in to delete your account.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Cascades through profiles -> posts, ratings, comments, reports, blocks.
  delete from auth.users where id = caller;
end;
$$;

-- ---------------------------------------------------------------------------
-- log_moderation_action — helper used by the moderator dashboard
-- ---------------------------------------------------------------------------
create or replace function public.log_moderation_action(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator(auth.uid()) then
    raise exception 'Moderator privileges required.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.moderation_actions (moderator_id, action, target_type, target_id, notes)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_notes);
end;
$$;
