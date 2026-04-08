-- Migration 148: Ensure tenant_features RLS policy exists.
--
-- All app reads/writes use createAdminClient() (service-role key) which
-- bypasses RLS. The policy below satisfies the Supabase linter and makes
-- the intent explicit: no regular authenticated user should touch this
-- table directly; that path is blocked by default when no policy matches.
--
-- Uses DROP IF EXISTS + CREATE so the migration is safe to run even if
-- the policy was already created by migration 145 or 146.

drop policy if exists "Super admins can read tenant_features" on public.tenant_features;

create policy "Super admins can read tenant_features"
  on public.tenant_features
  for select
  using (
    exists (
      select 1 from public.profiles
      where id   = auth.uid()
        and role = 'super_admin'
    )
  );
