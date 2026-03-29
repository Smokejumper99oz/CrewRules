-- account_deletion_log is written/read only via service role (admin client).
-- Linter 0008 requires at least one policy when RLS is enabled.
-- These policies deny anon/authenticated JWT access; service_role bypasses RLS in Supabase.

create policy "account_deletion_log_deny_anon"
  on public.account_deletion_log
  for all
  to anon
  using (false)
  with check (false);

create policy "account_deletion_log_deny_authenticated"
  on public.account_deletion_log
  for all
  to authenticated
  using (false)
  with check (false);
