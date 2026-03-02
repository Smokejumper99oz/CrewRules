-- First leg departure time (e.g. "08:50") from ICS leg rows, for trip duty range display
alter table public.schedule_events
  add column if not exists first_leg_departure_time text;
