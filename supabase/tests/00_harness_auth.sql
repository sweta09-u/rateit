-- 00_harness_auth.sql — local stand-ins for the Supabase-provided objects.
-- NOT part of the app's migrations; used only by the local test run.

create schema if not exists auth;
create schema if not exists extensions;

-- pgcrypto ships with Supabase but not with this local test server. Provide the
-- two functions the seed reaches for so the same seed file runs unchanged.
create or replace function extensions.gen_salt(kind text)
returns text language sql as $$ select '$2a$06$localsaltlocalsaltlo' $$;

create or replace function extensions.crypt(pw text, salt text)
returns text language sql as $$ select 'local$' || md5(pw || salt) $$;

create table if not exists auth.users (
  id                 uuid primary key,
  instance_id        uuid,
  aud                text,
  role               text,
  email              text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data  jsonb,
  raw_user_meta_data jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- auth.identities, as Supabase's GoTrue creates it for a password signup.
create table if not exists auth.identities (
  id              uuid primary key default gen_random_uuid(),
  provider_id     text not null,
  user_id         uuid not null,
  identity_data   jsonb not null,
  provider        text not null,
  last_sign_in_at timestamptz,
  created_at      timestamptz,
  updated_at      timestamptz,
  email           text generated always as (lower(identity_data ->> 'email')) stored,
  unique (provider_id, provider)
);

-- auth.uid() reads the "sub" claim from the JWT, exactly as Supabase does.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- Assertion helper: raise loudly on failure so ON_ERROR_STOP trips.
create or replace function public.t_assert(cond boolean, msg text)
returns void
language plpgsql
as $$
begin
  if cond is distinct from true then
    raise exception 'ASSERT FAILED -> %', msg;
  end if;
  raise notice '  ok  %', msg;
end;
$$;

-- ---------------------------------------------------------------------------
-- Minimal stand-in for the Supabase Storage schema, so 0008_storage_media.sql
-- and its policies can be exercised locally. Mirrors the columns and the
-- foldername() helper the migration depends on.
-- ---------------------------------------------------------------------------
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  owner              uuid,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create table if not exists storage.objects (
  id               uuid primary key default gen_random_uuid(),
  bucket_id        text references storage.buckets (id),
  name             text not null,
  owner            uuid,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  metadata         jsonb,
  path_tokens      text[] generated always as (string_to_array(name, '/')) stored
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1:array_length(parts, 1) - 1];
end $$;

grant usage on schema storage to anon, authenticated;
grant select on storage.objects to anon;
grant select, insert, update, delete on storage.objects to authenticated;
