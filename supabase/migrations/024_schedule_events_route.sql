-- First leg route (origin → destination) from ICS DESCRIPTION legs section
alter table public.schedule_events
  add column if not exists route text;
