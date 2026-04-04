-- Explicit RLS policies for Supabase linter (lint 0008_rls_enabled_no_policy).
-- Service role bypasses RLS; anon/authenticated have no direct access.

drop policy if exists "pending_signups_no_client_access" on public.pending_signups;
create policy "pending_signups_no_client_access"
  on public.pending_signups
  for all
  to anon, authenticated
  using (false)
  with check (false);

alter table public.stripe_subscription_payments enable row level security;

drop policy if exists "stripe_subscription_payments_no_client_access" on public.stripe_subscription_payments;
create policy "stripe_subscription_payments_no_client_access"
  on public.stripe_subscription_payments
  for all
  to anon, authenticated
  using (false)
  with check (false);
