-- Add RLS policies for Super Admin-only tables that had RLS enabled but no policies.
-- Service role (admin client) bypasses RLS and is unaffected.
-- The security-definer update_online_peak_today() function also bypasses RLS.

alter table public.online_peak_daily enable row level security;

drop policy if exists "Super admin can read online_peak_daily" on public.online_peak_daily;
create policy "Super admin can read online_peak_daily"
  on public.online_peak_daily for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'super_admin'
    )
  );

drop policy if exists "Super admin can read system_events" on public.system_events;
create policy "Super admin can read system_events"
  on public.system_events for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'super_admin'
    )
  );
