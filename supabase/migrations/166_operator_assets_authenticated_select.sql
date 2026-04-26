-- Allow authenticated users to read/list demo135 aircraft hero objects so the app can
-- verify existence via Storage API (HTTP HEAD on public URLs is unreliable in some environments).

drop policy if exists "Authenticated select operator assets demo135 aircraft hero" on storage.objects;

create policy "Authenticated select operator assets demo135 aircraft hero"
  on storage.objects for select
  using (
    bucket_id = 'operator-assets'
    and auth.role() = 'authenticated'
    and name ~ '^tenants/demo135/aircraft/[^/]+/hero\.jpg$'
  );
