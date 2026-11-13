-- =============================================================================
-- RateIt — seed.sql
--
-- PREVIEW DATA ONLY. Everything created here is flagged is_demo = true and
-- authored by accounts whose usernames begin with "demo_". The app shows a
-- "Demo" badge on all of it. None of this represents real community activity,
-- and it is safe to delete with:
--     delete from public.profiles where username like 'demo\_%';
--
-- Demo account password (local preview only): demo-password
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SAFETY GUARD. This file is a local-testing fixture. It refuses to run
-- against a database that already holds real accounts, so it cannot be used to
-- re-introduce demo content into production by accident.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.profiles where username not like 'demo\_%') then
    raise exception
      'Refusing to seed: this database already has real accounts. seed.sql is for local testing only.';
  end if;
end $$;

-- pgcrypto provides crypt()/gen_salt() for the demo password hashes. Supabase
-- ships it; on a bare PostgreSQL it may be absent, in which case the demo
-- accounts simply get placeholder hashes and cannot be logged into.
do $$
begin
  create extension if not exists pgcrypto with schema extensions;
exception when others then
  raise notice 'pgcrypto unavailable — demo password hashes are placeholders';
end $$;

-- ---------------------------------------------------------------------------
-- Demo accounts. Inserting into auth.users fires handle_new_user(), which
-- creates the matching profile row.
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('d0000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.alex@example.com',
   extensions.crypt('demo-password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"username":"demo_alex","display_name":"Alex (demo)"}', now(), now()),

  ('d0000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.priya@example.com',
   extensions.crypt('demo-password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"username":"demo_priya","display_name":"Priya (demo)"}', now(), now()),

  ('d0000000-0000-4000-a000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.sam@example.com',
   extensions.crypt('demo-password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"username":"demo_sam","display_name":"Sam (demo)"}', now(), now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Email identities. Modern GoTrue requires an identity row alongside the user
-- before password sign-in will work, so without these the demo accounts would
-- appear in the feed but could not actually be logged into.
-- ---------------------------------------------------------------------------
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values
  ('d0000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000001',
   '{"sub":"d0000000-0000-4000-a000-000000000001","email":"demo.alex@example.com","email_verified":true,"phone_verified":false}',
   'email', now(), now(), now()),
  ('d0000000-0000-4000-a000-000000000002', 'd0000000-0000-4000-a000-000000000002',
   '{"sub":"d0000000-0000-4000-a000-000000000002","email":"demo.priya@example.com","email_verified":true,"phone_verified":false}',
   'email', now(), now(), now()),
  ('d0000000-0000-4000-a000-000000000003', 'd0000000-0000-4000-a000-000000000003',
   '{"sub":"d0000000-0000-4000-a000-000000000003","email":"demo.sam@example.com","email_verified":true,"phone_verified":false}',
   'email', now(), now(), now())
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Demo posts
-- ---------------------------------------------------------------------------
insert into public.posts (id, author_id, title, body, category, is_demo, created_at)
values
  ('d1000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000001',
   'When the code compiles on the first try',
   'You stare at it for a second, suspicious. Then you run the tests, just to be sure. (Demo post.)',
   'Meme', true, now() - interval '6 days'),

  ('d1000000-0000-4000-a000-000000000002', 'd0000000-0000-4000-a000-000000000002',
   'Dark mode should be the default, not the setting',
   'Every app ships light-first and hides dark mode in a menu. Flip it. Dark by default, light on request. (Demo post.)',
   'Opinion', true, now() - interval '5 days'),

  ('d1000000-0000-4000-a000-000000000003', 'd0000000-0000-4000-a000-000000000003',
   'A notebook that never runs out of pages',
   'A pocket notebook with an e-ink strip at the bottom that saves whatever you scribble. One page, endless paper. (Demo post.)',
   'Product', true, now() - interval '4 days'),

  ('d1000000-0000-4000-a000-000000000004', 'd0000000-0000-4000-a000-000000000001',
   'A rating widget that admits when it is not sure',
   'Instead of a single number, a rating could show a small range when opinions disagree. Honest uncertainty beats false precision. (Demo post.)',
   'Idea', true, now() - interval '3 days'),

  ('d1000000-0000-4000-a000-000000000005', 'd0000000-0000-4000-a000-000000000002',
   'What is the most underrated skill right now?',
   'Not coding, not design. I would say knowing how to ask a clear question. What would you pick? (Demo post.)',
   'Question', true, now() - interval '2 days'),

  ('d1000000-0000-4000-a000-000000000006', 'd0000000-0000-4000-a000-000000000003',
   'Weekend project: a tiny weather dashboard',
   'One page, one city, no ads. It turned out to be a nice excuse to learn a new chart library. (Demo post.)',
   'Other', true, now() - interval '1 day'),

  ('d1000000-0000-4000-a000-000000000007', 'd0000000-0000-4000-a000-000000000001',
   'An unrated post, to show the difference',
   'This demo post has no ratings at all. It should read "Not yet rated" rather than a score of zero. (Demo post.)',
   'Idea', true, now() - interval '12 hours')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Demo ratings. Never self-ratings; each demo account rates another's post.
-- ---------------------------------------------------------------------------
insert into public.ratings (post_id, user_id, score, is_demo)
values
  -- "Meme" post -> average 9.0
  ('d1000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000002',  8, true),
  ('d1000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000003', 10, true),
  -- "Opinion" post -> average 2.0
  ('d1000000-0000-4000-a000-000000000002', 'd0000000-0000-4000-a000-000000000001',  6, true),
  ('d1000000-0000-4000-a000-000000000002', 'd0000000-0000-4000-a000-000000000003', -2, true),
  -- "Product" post -> average 4.5
  ('d1000000-0000-4000-a000-000000000003', 'd0000000-0000-4000-a000-000000000001',  4, true),
  ('d1000000-0000-4000-a000-000000000003', 'd0000000-0000-4000-a000-000000000002',  5, true),
  -- "Idea" post -> split, average -2.0 (a deliberately controversial demo)
  ('d1000000-0000-4000-a000-000000000004', 'd0000000-0000-4000-a000-000000000002', -5, true),
  ('d1000000-0000-4000-a000-000000000004', 'd0000000-0000-4000-a000-000000000003',  1, true),
  -- "Question" post -> average 6.5
  ('d1000000-0000-4000-a000-000000000005', 'd0000000-0000-4000-a000-000000000001',  7, true),
  ('d1000000-0000-4000-a000-000000000005', 'd0000000-0000-4000-a000-000000000003',  6, true),
  -- "Other" post -> average 0.0, with two ratings (distinct from "not rated")
  ('d1000000-0000-4000-a000-000000000006', 'd0000000-0000-4000-a000-000000000001',  0, true),
  ('d1000000-0000-4000-a000-000000000006', 'd0000000-0000-4000-a000-000000000002',  0, true)
  -- post ...007 intentionally has no ratings
on conflict (post_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Demo comments
-- ---------------------------------------------------------------------------
insert into public.comments (id, post_id, author_id, body, is_demo)
values
  ('d2000000-0000-4000-a000-000000000001', 'd1000000-0000-4000-a000-000000000001',
   'd0000000-0000-4000-a000-000000000002', 'The second you trust it, it betrays you. (Demo comment.)', true),
  ('d2000000-0000-4000-a000-000000000002', 'd1000000-0000-4000-a000-000000000005',
   'd0000000-0000-4000-a000-000000000003', 'Being able to say "I do not know yet" is underrated too. (Demo comment.)', true)
on conflict (id) do nothing;
