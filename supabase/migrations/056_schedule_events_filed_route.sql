-- Cached filed route string for Weather Brief / first leg of trip
alter table public.schedule_events
  add column if not exists filed_route text;
