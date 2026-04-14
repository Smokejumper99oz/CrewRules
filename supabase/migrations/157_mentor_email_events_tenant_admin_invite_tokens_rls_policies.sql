-- Linter 0008 (rls_enabled_no_policy): tables had RLS on but zero policies.
-- Both tables are read/written only via service role (admin client).
-- Deny anon/authenticated JWT access; service_role bypasses RLS in Supabase.

alter table public.mentor_email_events enable row level security;

create policy "mentor_email_events_deny_anon"
  on public.mentor_email_events
  for all
  to anon
  using (false)
  with check (false);

create policy "mentor_email_events_deny_authenticated"
  on public.mentor_email_events
  for all
  to authenticated
  using (false)
  with check (false);

create policy "tenant_admin_invite_tokens_deny_anon"
  on public.tenant_admin_invite_tokens
  for all
  to anon
  using (false)
  with check (false);

create policy "tenant_admin_invite_tokens_deny_authenticated"
  on public.tenant_admin_invite_tokens
  for all
  to authenticated
  using (false)
  with check (false);
