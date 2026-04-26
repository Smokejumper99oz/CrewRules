-- Public hero/operator imagery (demo135 pilot dashboard aircraft photo, etc.)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'operator-assets',
  'operator-assets',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Objects use path shape: tenants/demo135/aircraft/{tail}/hero.jpg
--
-- No broad SELECT on storage.objects: public buckets serve files by URL without it; a permissive
-- SELECT allows clients to list every object in the bucket (Supabase linter 0025).

drop policy if exists "Public read operator assets" on storage.objects;

drop policy if exists "Authenticated upload operator assets demo135 aircraft hero" on storage.objects;
create policy "Authenticated upload operator assets demo135 aircraft hero"
  on storage.objects for insert
  with check (
    bucket_id = 'operator-assets'
    and auth.role() = 'authenticated'
    and name ~ '^tenants/demo135/aircraft/[^/]+/hero\.jpg$'
  );

drop policy if exists "Authenticated update operator assets demo135 aircraft hero" on storage.objects;
create policy "Authenticated update operator assets demo135 aircraft hero"
  on storage.objects for update
  using (
    bucket_id = 'operator-assets'
    and auth.role() = 'authenticated'
    and name ~ '^tenants/demo135/aircraft/[^/]+/hero\.jpg$'
  );

drop policy if exists "Authenticated delete operator assets demo135 aircraft hero" on storage.objects;
create policy "Authenticated delete operator assets demo135 aircraft hero"
  on storage.objects for delete
  using (
    bucket_id = 'operator-assets'
    and auth.role() = 'authenticated'
    and name ~ '^tenants/demo135/aircraft/[^/]+/hero\.jpg$'
  );
