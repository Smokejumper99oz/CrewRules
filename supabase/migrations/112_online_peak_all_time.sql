-- All-time peak concurrent online users (same session approximation as daily peak).
-- Updated when Super Admin dashboard loads with current online count exceeds stored peak.

create table if not exists public.online_peak_all_time (
  id smallint primary key default 1 constraint online_peak_all_time_singleton check (id = 1),
  peak integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.update_online_peak_all_time(p_online integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peak integer;
begin
  insert into public.online_peak_all_time (id, peak, updated_at)
  values (1, greatest(coalesce(p_online, 0), 0), now())
  on conflict (id) do update set
    peak = greatest(public.online_peak_all_time.peak, excluded.peak),
    updated_at = case
      when excluded.peak > public.online_peak_all_time.peak then now()
      else public.online_peak_all_time.updated_at
    end
  returning peak into v_peak;

  return v_peak;
end;
$$;

comment on table public.online_peak_all_time is 'Single-row all-time peak concurrent online users. Updated on Super Admin page load when current count exceeds stored peak.';
comment on function public.update_online_peak_all_time(integer) is 'Sets all-time peak to max(stored, p_online). Returns new peak. Super Admin only.';

grant execute on function public.update_online_peak_all_time(integer) to service_role;
grant execute on function public.update_online_peak_all_time(integer) to authenticated;

alter table public.online_peak_all_time enable row level security;

drop policy if exists "Super admin can read online_peak_all_time" on public.online_peak_all_time;
create policy "Super admin can read online_peak_all_time"
  on public.online_peak_all_time for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'super_admin'
    )
  );
