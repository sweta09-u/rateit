-- =============================================================================
-- RateIt — 0005_hardening.sql
-- Tightens the function surface after the Supabase security linter flagged two
-- things:
--   1. Five functions had a mutable search_path.
--   2. Trigger-only functions were reachable through /rest/v1/rpc/ because
--      PostgreSQL grants EXECUTE to PUBLIC by default.
-- Neither was exploitable on its own, but both are worth closing.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Pin search_path so a caller cannot influence name resolution.
-- ---------------------------------------------------------------------------
alter function public.set_updated_at() set search_path = public;
alter function public.list_posts(text, text, uuid, integer, integer) set search_path = public;
alter function public.get_rating_breakdown(uuid) set search_path = public;
alter function public.get_community_stats() set search_path = public;
alter function public.get_user_stats(uuid) set search_path = public;

-- ---------------------------------------------------------------------------
-- 2. Trigger-only functions: these are invoked by the table triggers, never
--    directly. Firing a trigger does not check the caller's EXECUTE privilege,
--    so revoking it here changes nothing about how they work.
-- ---------------------------------------------------------------------------
revoke execute on function public.set_updated_at()            from public, anon, authenticated;
revoke execute on function public.handle_new_user()           from public, anon, authenticated;
revoke execute on function public.recalc_post_ratings()       from public, anon, authenticated;
revoke execute on function public.prevent_self_rating()       from public, anon, authenticated;
revoke execute on function public.protect_post_columns()      from public, anon, authenticated;
revoke execute on function public.protect_comment_columns()   from public, anon, authenticated;
revoke execute on function public.protect_profile_columns()   from public, anon, authenticated;
revoke execute on function public.enforce_rate_limit()        from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Make the intended API surface explicit.
--    The authorisation helpers must stay callable by anon and authenticated:
--    Row Level Security policies are evaluated with the querying user's
--    privileges, so a policy that calls is_moderator() needs that role to hold
--    EXECUTE. Everything else is narrowed.
-- ---------------------------------------------------------------------------
revoke execute on function public.is_moderator(uuid)             from public;
revoke execute on function public.is_banned(uuid)                from public;
revoke execute on function public.is_blocked_between(uuid, uuid) from public;

-- Deleting an account requires being signed in; anonymous visitors cannot.
revoke execute on function public.delete_own_account() from public, anon;

-- The moderation log is for signed-in users only (and it checks the role itself).
revoke execute on function public.log_moderation_action(text, text, uuid, text) from public, anon;
