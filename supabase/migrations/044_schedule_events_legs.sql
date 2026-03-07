-- Flight legs per trip (origin, destination, times) from ICS DESCRIPTION
alter table public.schedule_events
  add column if not exists legs jsonb;
