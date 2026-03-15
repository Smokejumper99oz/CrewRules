-- flightaware_usage is server-side only (service role inserts, super_admin reads).
-- RLS enabled with restrictive policy: no anon/authenticated access.
-- Service role bypasses RLS for logging and Super Admin metrics.
create policy "flightaware_usage_service_role_only"
  on public.flightaware_usage
  for all
  using (false)
  with check (false);
