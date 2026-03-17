-- Track daily peak of concurrent online users. Updated on each Super Admin page load.

create table if not exists public.online_peak_daily (
  day date primary key,
  peak integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.update_online_peak_today(p_online integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_peak integer;
begin
  insert into public.online_peak_daily (day, peak, updated_at)
  values (current_date, greatest(coalesce(p_online, 0), 0), now())
  on conflict (day)
  do update set
    peak = greatest(public.online_peak_daily.peak, excluded.peak),
    updated_at = now()
  returning peak into current_peak;

  return current_peak;
end;
$$;

comment on table public.online_peak_daily is 'Daily peak of concurrent online users. One row per day. Updated on Super Admin page load.';
comment on function public.update_online_peak_today(integer) is 'Upserts today peak with max(current, p_online). Returns new peak. Super Admin only.';
