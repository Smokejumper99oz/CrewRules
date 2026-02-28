-- pairing_days: duty periods in the pairing (for 5 hr/day min credit).
-- block_minutes: trip block time (wheels up to wheels down).
alter table public.schedule_events
  add column if not exists pairing_days integer,
  add column if not exists block_minutes integer;
