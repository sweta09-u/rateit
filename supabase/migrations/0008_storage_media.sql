-- =============================================================================
-- RateIt — 0008_storage_media.sql
--
-- Direct image uploads from the user's device (post images and profile photos)
-- need somewhere to live. One public bucket, with the usual Supabase folder
-- convention: every object sits under a folder named after the uploader's user
-- id, and the policies below only ever let you write inside your own folder.
--
-- Reads are public because these are images shown on a public feed.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  5242880,  -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- storage.objects policies. Paths are always <user-id>/<kind>/<file>.
-- ---------------------------------------------------------------------------

drop policy if exists media_public_read on storage.objects;
create policy media_public_read on storage.objects
  for select
  using (bucket_id = 'media');

drop policy if exists media_insert_own on storage.objects;
create policy media_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists media_update_own on storage.objects;
create policy media_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists media_delete_own on storage.objects;
create policy media_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
