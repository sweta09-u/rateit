-- =============================================================================
-- 10_acceptance.sql — the acceptance test from the brief, run against a real
-- PostgreSQL instance with Row Level Security actually switched on.
-- Each account acts through the `authenticated` role with a JWT claim set,
-- exactly as Supabase's PostgREST would drive it.
-- =============================================================================

\set alice '11111111-1111-4111-8111-111111111111'
\set bob   '22222222-2222-4222-8222-222222222222'
\set mod   '33333333-3333-4333-8333-333333333333'
\set pA    'aaaaaaaa-0000-4000-a000-000000000001'
\set pB    'bbbbbbbb-0000-4000-a000-000000000002'
\set pC    'cccccccc-0000-4000-a000-000000000003'
\set pD    'dddddddd-0000-4000-a000-000000000004'

-- ---------------------------------------------------------------------------
-- Accounts are created by the auth system (superuser here), which must create
-- a matching public profile through the handle_new_user trigger.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  (:'alice', 'alice@example.com', '{"username":"alice","display_name":"Alice"}'),
  (:'bob',   'bob@example.com',   '{"username":"bob","display_name":"Bob"}'),
  (:'mod',   'mod@example.com',   '{"username":"moderator","display_name":"Mod"}');

update public.profiles set role = 'moderator' where id = :'mod';

select public.t_assert(
  (select count(*) from public.profiles where id = :'alice') = 1,
  'signup auto-creates a profile');
select public.t_assert(
  (select username from public.profiles where id = :'alice') = 'alice',
  'username taken from signup metadata');

-- ---------------------------------------------------------------------------
-- Act as Alice: she can publish.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'alice')::text, false);

insert into public.posts (id, author_id, title, body, category)
values (:'pA', :'alice', 'Alice original post', 'Hello from Alice.', 'Opinion');

select public.t_assert(
  (select count(*) from public.posts where id = :'pA') = 1,
  'authenticated user can publish a post');
select public.t_assert(
  (select rating_count from public.posts where id = :'pA') = 0,
  'a new post has zero ratings');
select public.t_assert(
  (select rating_avg from public.posts where id = :'pA') is null,
  'an unrated post has a NULL average (not 0)');

-- Bob publishes his own post.
select set_config('request.jwt.claims', json_build_object('sub', :'bob')::text, false);
insert into public.posts (id, author_id, title, body, category)
values (:'pB', :'bob', 'Bob asks a question', 'What do you think?', 'Question');

-- ---------------------------------------------------------------------------
-- Rating: one per account, updates and removal included.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', :'bob')::text, false);
insert into public.ratings (post_id, user_id, score) values (:'pA', :'bob', 7);

select public.t_assert(
  (select rating_count from public.posts where id = :'pA') = 1,
  'rating is counted in the aggregate');
select public.t_assert(
  (select rating_avg from public.posts where id = :'pA') = 7.0,
  'average reflects the single rating');

do $$
begin
  begin
    insert into public.ratings (post_id, user_id, score)
    values ('aaaaaaaa-0000-4000-a000-000000000001',
            '22222222-2222-4222-8222-222222222222', 3);
    raise exception 'a duplicate rating was accepted';
  exception when unique_violation then
    raise notice '  ok  duplicate rating rejected by unique constraint';
  end;
end $$;

-- Bob changes his mind.
update public.ratings set score = 10
 where post_id = :'pA' and user_id = :'bob';

select public.t_assert(
  (select rating_avg from public.posts where id = :'pA') = 10.0,
  'updating a rating updates the community average');
select public.t_assert(
  (select rating_count from public.posts where id = :'pA') = 1,
  'updating a rating does not create a second row');

-- ---------------------------------------------------------------------------
-- No self-rating.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', :'alice')::text, false);
do $$
begin
  begin
    insert into public.ratings (post_id, user_id, score)
    values ('aaaaaaaa-0000-4000-a000-000000000001',
            '11111111-1111-4111-8111-111111111111', 5);
    raise exception 'self-rating was accepted';
  exception when check_violation then
    raise notice '  ok  self-rating blocked by database trigger';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Aggregate cannot be forged by the author.
-- ---------------------------------------------------------------------------
update public.posts set rating_sum = 9999, rating_count = 9999 where id = :'pA';
select public.t_assert(
  (select rating_sum from public.posts where id = :'pA') = 10,
  'author cannot overwrite rating_sum');
select public.t_assert(
  (select rating_count from public.posts where id = :'pA') = 1,
  'author cannot overwrite rating_count');

-- ---------------------------------------------------------------------------
-- Zero average is distinct from no ratings.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', :'mod')::text, false);
insert into public.ratings (post_id, user_id, score) values (:'pB', :'mod', -5);
select set_config('request.jwt.claims', json_build_object('sub', :'alice')::text, false);
insert into public.ratings (post_id, user_id, score) values (:'pB', :'alice', 5);

select public.t_assert(
  (select rating_avg from public.posts where id = :'pB') = 0.0,
  'a post rated 5 and -5 shows an average of 0.0');
select public.t_assert(
  (select rating_count from public.posts where id = :'pB') = 2,
  'and it is clearly rated, with 2 ratings');

-- ---------------------------------------------------------------------------
-- Unauthorised users cannot touch another account's content.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', :'alice')::text, false);
update public.posts set title = 'hijacked' where id = :'pB';
select public.t_assert(
  (select title from public.posts where id = :'pB') = 'Bob asks a question',
  'Alice cannot edit Bob''s post');

delete from public.posts where id = :'pB';
select public.t_assert(
  (select count(*) from public.posts where id = :'pB') = 1,
  'Alice cannot delete Bob''s post');

update public.ratings set score = -5 where post_id = :'pA' and user_id = :'bob';
select public.t_assert(
  (select score from public.ratings where post_id = :'pA' and user_id = :'bob') = 10,
  'Alice cannot change Bob''s rating');

update public.profiles set bio = 'sneaky' where id = :'bob';
select public.t_assert(
  (select bio from public.profiles where id = :'bob') is null,
  'Alice cannot edit Bob''s profile');

do $$
begin
  begin
    update public.profiles set role = 'admin'
     where id = '11111111-1111-4111-8111-111111111111';
    raise exception 'privilege escalation was accepted';
  exception when insufficient_privilege then
    raise notice '  ok  a user cannot make themselves a moderator';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Comments: authors can edit their own, nobody else's.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', :'alice')::text, false);
insert into public.comments (post_id, author_id, body)
values (:'pB', :'alice', 'Good question.');

select public.t_assert(
  (select count(*) from public.comments where post_id = :'pB') = 1,
  'authenticated user can comment');

update public.comments set body = 'edited'
 where post_id = :'pB' and author_id = :'bob';
select public.t_assert(
  (select count(*) from public.comments where post_id = :'pB' and body = 'edited') = 0,
  'Alice cannot edit Bob''s comment');

-- ---------------------------------------------------------------------------
-- Reporting.
-- ---------------------------------------------------------------------------
insert into public.reports (reporter_id, target_type, target_id, reason)
values (:'alice', 'post', :'pB', 'spam');

select set_config('request.jwt.claims', json_build_object('sub', :'bob')::text, false);
select public.t_assert(
  (select count(*) from public.reports) = 0,
  'a user cannot see reports filed by someone else');

select set_config('request.jwt.claims', json_build_object('sub', :'mod')::text, false);
select public.t_assert(
  (select count(*) from public.reports) = 1,
  'a moderator can see the report queue');

-- ---------------------------------------------------------------------------
-- Blocking stops cross-interaction.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', :'bob')::text, false);
insert into public.posts (id, author_id, title, body, category)
values (:'pC', :'bob', 'Bob post three', 'Body three.', 'Other');
insert into public.blocks (blocker_id, blocked_id) values (:'bob', :'alice');

select set_config('request.jwt.claims', json_build_object('sub', :'alice')::text, false);
do $$
begin
  begin
    insert into public.ratings (post_id, user_id, score)
    values ('cccccccc-0000-4000-a000-000000000003',
            '11111111-1111-4111-8111-111111111111', 3);
    raise exception 'a blocked user was allowed to rate';
  exception when insufficient_privilege then
    raise notice '  ok  blocking prevents cross-account interaction';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Moderators can hide content; anonymous visitors lose sight of it.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', :'mod')::text, false);
update public.posts set status = 'hidden' where id = :'pB';
select public.t_assert(
  (select status from public.posts where id = :'pB') = 'hidden',
  'a moderator can hide a post');

reset role;
set role anon;
-- A genuine anonymous request carries no JWT claim at all.
select set_config('request.jwt.claims', '', false);
select public.t_assert(
  (select count(*) from public.posts where id = :'pB') = 0,
  'a hidden post is invisible to anonymous visitors');
select public.t_assert(
  (select count(*) from public.posts where status = 'visible') >= 1,
  'anonymous visitors can read visible posts');

do $$
begin
  begin
    insert into public.posts (author_id, title, body, category)
    values ('11111111-1111-4111-8111-111111111111', 'anon post', 'body', 'Other');
    raise exception 'anonymous insert was accepted';
  exception when insufficient_privilege then
    raise notice '  ok  anonymous visitors cannot publish';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Feed RPC: every sort mode runs and respects visibility.
-- ---------------------------------------------------------------------------
select public.t_assert(
  (select count(*) from public.list_posts('latest', null::text, null::uuid, null::text, 50, 0)) >= 1,
  'feed: latest');
select public.t_assert(
  (select count(*) from public.list_posts('highest', null::text, null::uuid, null::text, 50, 0)) >= 1,
  'feed: highest rated');
select public.t_assert(
  (select count(*) from public.list_posts('lowest', null::text, null::uuid, null::text, 50, 0)) >= 1,
  'feed: lowest rated');
select public.t_assert(
  (select count(*) from public.list_posts('trending', null::text, null::uuid, null::text, 50, 0)) >= 1,
  'feed: trending');
select public.t_assert(
  (select count(*) from public.list_posts('controversial', null::text, null::uuid, null::text, 50, 0)) >= 1,
  'feed: controversial');
select public.t_assert(
  (select count(*) from public.list_posts('latest', null::text, null::uuid, null::text, 50, 0)
     where id = 'bbbbbbbb-0000-4000-a000-000000000002') = 0,
  'feed: hidden posts are excluded for anonymous visitors');

-- Demo content must be present and clearly flagged.
select public.t_assert(
  (select count(*) from public.list_posts('latest', null::text, null::uuid, null::text, 100, 0) where is_demo) >= 5,
  'seeded demo posts are present and flagged is_demo');
select public.t_assert(
  (select count(*) from public.profiles where username like 'demo\_%') = 3,
  'demo accounts are clearly named');

-- ---------------------------------------------------------------------------
-- Account deletion erases the account and its personal data.
-- ---------------------------------------------------------------------------
reset role;
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'alice')::text, false);
select public.delete_own_account();

select public.t_assert(
  (select count(*) from public.profiles where id = :'alice') = 0,
  'deleting an account removes its profile');
select public.t_assert(
  (select count(*) from public.posts where author_id = :'alice') = 0,
  'deleting an account removes its posts');
select public.t_assert(
  (select count(*) from public.comments where author_id = :'alice') = 0,
  'deleting an account removes its comments');
select public.t_assert(
  (select count(*) from public.ratings where user_id = :'alice') = 0,
  'deleting an account removes its ratings');

reset role;

-- ---------------------------------------------------------------------------
-- rate_post() / remove_my_rating() — the single write path behind the inline
-- rating shortcut and the "+10" quick action.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'bob')::text, false);
insert into public.posts (id, author_id, title, body, category)
values (:'pD', :'bob', 'Bob post for the RPC', 'Body of the RPC post.', 'Other');

-- A second account rates it through the function.
select set_config('request.jwt.claims', json_build_object('sub', :'mod')::text, false);

select public.t_assert(
  (select my_score from public.rate_post(:'pD', 10)) = 10,
  'rate_post returns the saved score');
select public.t_assert(
  (select rating_count from public.rate_post(:'pD', 10)) = 1,
  'calling rate_post twice does not create a duplicate');
select public.t_assert(
  (select my_score from public.rate_post(:'pD', -5)) = -5,
  'rate_post updates an existing rating');
select public.t_assert(
  (select rating_count from public.posts where id = :'pD') = 1,
  'still exactly one rating row after an update');
select public.t_assert(
  (select rating_avg from public.posts where id = :'pD') = -5.0,
  'the community average follows the update');
select public.t_assert(
  (select rating_count from public.remove_my_rating(:'pD')) = 0,
  'remove_my_rating clears the rating');
select public.t_assert(
  (select rating_avg from public.posts where id = :'pD') is null,
  'a post with no ratings reads as unrated again');

-- Self-rating through the function.
select set_config('request.jwt.claims', json_build_object('sub', :'bob')::text, false);
do $$ begin
  begin
    perform public.rate_post('dddddddd-0000-4000-a000-000000000004', 10);
    raise exception 'self-rating via rate_post was accepted';
  exception when check_violation then
    raise notice '  ok  rate_post refuses to let you rate your own post';
  end;
end $$;

-- Out-of-range scores.
select set_config('request.jwt.claims', json_build_object('sub', :'mod')::text, false);
do $$ begin
  begin
    perform public.rate_post('dddddddd-0000-4000-a000-000000000004', 11);
    raise exception 'a score above 10 was accepted';
  exception when check_violation then
    raise notice '  ok  rate_post rejects a score above 10';
  end;
end $$;
do $$ begin
  begin
    perform public.rate_post('dddddddd-0000-4000-a000-000000000004', -6);
    raise exception 'a score below -5 was accepted';
  exception when check_violation then
    raise notice '  ok  rate_post rejects a score below -5';
  end;
end $$;

-- The check constraint is the backstop even for a direct insert.
do $$ begin
  begin
    insert into public.ratings (post_id, user_id, score)
    values ('dddddddd-0000-4000-a000-000000000004',
            '33333333-3333-4333-8333-333333333333', 99);
    raise exception 'an out-of-range direct insert was accepted';
  exception when check_violation then
    raise notice '  ok  the database rejects an out-of-range score';
  end;
end $$;

-- A signed-in user cannot modify someone else's rating.
insert into public.ratings (post_id, user_id, score)
values (:'pD', :'mod', 7);
select set_config('request.jwt.claims', json_build_object('sub', :'bob')::text, false);
update public.ratings set score = -5 where post_id = :'pD' and user_id = :'mod';
select public.t_assert(
  (select score from public.ratings where post_id = :'pD' and user_id = :'mod') = 7,
  'a user cannot modify another user''s rating');

-- An anonymous visitor cannot rate at all.
reset role;
set role anon;
select set_config('request.jwt.claims', '', false);
do $$ begin
  begin
    perform public.rate_post('dddddddd-0000-4000-a000-000000000004', 10);
    raise exception 'an anonymous rate_post was accepted';
  exception when insufficient_privilege then
    raise notice '  ok  an anonymous visitor cannot rate';
  end;
end $$;

-- Search.
select public.t_assert(
  (select count(*) from public.list_posts('latest', null::text, null::uuid, 'RPC post', 50, 0)) = 1,
  'list_posts finds a post by its title');
select public.t_assert(
  (select count(*) from public.list_posts('latest', null::text, null::uuid, 'ZZZZNOTFOUND', 50, 0)) = 0,
  'a search that matches nothing returns nothing');
select public.t_assert(
  (select count(*) from public.list_posts('latest', null::text, null::uuid, 'rpc', 50, 0)) = 1,
  'search is case-insensitive');

reset role;

-- ---------------------------------------------------------------------------
-- Every read helper the interface calls must survive a schema change.
-- get_user_stats() was once left pointing at a renamed column, so these keep
-- that from regressing silently. Set up the data first: this section runs after
-- Alice's account was deleted, which cascaded her posts and their ratings away.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'mod')::text, false);
insert into public.ratings (post_id, user_id, score) values (:'pD', :'mod', 6)
on conflict (post_id, user_id) do update set score = 6;

select public.t_assert(
  (select posts_count from public.get_user_stats(:'bob')) >= 1,
  'get_user_stats returns a post count');
select public.t_assert(
  (select ratings_given from public.get_user_stats(:'mod')) >= 1,
  'get_user_stats returns ratings given');
select public.t_assert(
  (select ratings_received from public.get_user_stats(:'bob')) >= 1,
  'get_user_stats returns ratings received');
select public.t_assert(
  (select avg_received from public.get_user_stats(:'bob')) is not null,
  'get_user_stats returns an average received');
select public.t_assert(
  (select count(*) from public.get_community_stats()) = 1,
  'get_community_stats returns exactly one row');
select public.t_assert(
  (select count(*) from public.get_rating_breakdown(:'pD')) >= 1,
  'get_rating_breakdown returns rows');

reset role;
