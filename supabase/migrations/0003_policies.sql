-- =============================================================================
-- RateIt — 0003_policies.sql
-- Row Level Security. Every user-facing table is locked down here; the
-- browser role can only ever do what these policies allow.
-- =============================================================================

-- Helper: is this account banned? (SECURITY DEFINER to avoid policy recursion)
create or replace function public.is_banned(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_banned from public.profiles where id = uid),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles
  for select using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_delete_self on public.profiles;
create policy profiles_delete_self on public.profiles
  for delete using (id = auth.uid());

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
alter table public.posts enable row level security;

drop policy if exists posts_select_visible on public.posts;
create policy posts_select_visible on public.posts
  for select using (
    status = 'visible'
    or author_id = auth.uid()
    or public.is_moderator(auth.uid())
  );

drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts
  for insert with check (
    author_id = auth.uid()
    and not public.is_banned(auth.uid())
  );

drop policy if exists posts_update_own_or_mod on public.posts;
create policy posts_update_own_or_mod on public.posts
  for update using (
    author_id = auth.uid() or public.is_moderator(auth.uid())
  ) with check (
    author_id = auth.uid() or public.is_moderator(auth.uid())
  );

drop policy if exists posts_delete_own_or_mod on public.posts;
create policy posts_delete_own_or_mod on public.posts
  for delete using (
    author_id = auth.uid() or public.is_moderator(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- ratings
-- ---------------------------------------------------------------------------
alter table public.ratings enable row level security;

drop policy if exists ratings_select_public on public.ratings;
create policy ratings_select_public on public.ratings
  for select using (true);

drop policy if exists ratings_insert_own on public.ratings;
create policy ratings_insert_own on public.ratings
  for insert with check (
    user_id = auth.uid()
    and not public.is_banned(auth.uid())
    -- only on a post that is actually visible
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'visible'
    )
    -- and never across a block, in either direction
    and not public.is_blocked_between(
      auth.uid(),
      (select p.author_id from public.posts p where p.id = post_id)
    )
  );

drop policy if exists ratings_update_own on public.ratings;
create policy ratings_update_own on public.ratings
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists ratings_delete_own on public.ratings;
create policy ratings_delete_own on public.ratings
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
alter table public.comments enable row level security;

drop policy if exists comments_select_visible on public.comments;
create policy comments_select_visible on public.comments
  for select using (
    status = 'visible'
    or author_id = auth.uid()
    or public.is_moderator(auth.uid())
  );

drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments
  for insert with check (
    author_id = auth.uid()
    and not public.is_banned(auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'visible'
    )
    and not public.is_blocked_between(
      auth.uid(),
      (select p.author_id from public.posts p where p.id = post_id)
    )
  );

drop policy if exists comments_update_own_or_mod on public.comments;
create policy comments_update_own_or_mod on public.comments
  for update using (
    author_id = auth.uid() or public.is_moderator(auth.uid())
  ) with check (
    author_id = auth.uid() or public.is_moderator(auth.uid())
  );

drop policy if exists comments_delete_own_or_mod on public.comments;
create policy comments_delete_own_or_mod on public.comments
  for delete using (
    author_id = auth.uid() or public.is_moderator(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
alter table public.reports enable row level security;

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
  for insert with check (
    reporter_id = auth.uid()
    and not public.is_banned(auth.uid())
  );

drop policy if exists reports_select_own_or_mod on public.reports;
create policy reports_select_own_or_mod on public.reports
  for select using (
    reporter_id = auth.uid() or public.is_moderator(auth.uid())
  );

drop policy if exists reports_update_mod on public.reports;
create policy reports_update_mod on public.reports
  for update using (public.is_moderator(auth.uid()))
  with check (public.is_moderator(auth.uid()));

drop policy if exists reports_delete_mod on public.reports;
create policy reports_delete_mod on public.reports
  for delete using (public.is_moderator(auth.uid()));

-- ---------------------------------------------------------------------------
-- blocks — private to the person who made them
-- ---------------------------------------------------------------------------
alter table public.blocks enable row level security;

drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own on public.blocks
  for select using (blocker_id = auth.uid());

drop policy if exists blocks_insert_own on public.blocks;
create policy blocks_insert_own on public.blocks
  for insert with check (blocker_id = auth.uid());

drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_delete_own on public.blocks
  for delete using (blocker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- moderation_actions — moderators only
-- ---------------------------------------------------------------------------
alter table public.moderation_actions enable row level security;

drop policy if exists moderation_actions_select_mod on public.moderation_actions;
create policy moderation_actions_select_mod on public.moderation_actions
  for select using (public.is_moderator(auth.uid()));

drop policy if exists moderation_actions_insert_mod on public.moderation_actions;
create policy moderation_actions_insert_mod on public.moderation_actions
  for insert with check (public.is_moderator(auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants. Supabase sets these by default for the public schema; stating them
-- explicitly keeps behaviour identical on a plain PostgreSQL instance.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.profiles, public.posts, public.ratings, public.comments
  to anon;

grant select, insert, update, delete on
  public.profiles, public.posts, public.ratings, public.comments,
  public.reports, public.blocks, public.moderation_actions
  to authenticated;

grant execute on function
  public.is_moderator(uuid),
  public.is_banned(uuid),
  public.is_blocked_between(uuid, uuid)
  to anon, authenticated;

grant execute on function
  public.delete_own_account(),
  public.log_moderation_action(text, text, uuid, text)
  to authenticated;
