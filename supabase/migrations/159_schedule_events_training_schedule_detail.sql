-- Per-day training labels (ground school / SIM) parsed from FLICA DESCRIPTION for My Schedule popover.
alter table public.schedule_events
  add column if not exists training_schedule_detail jsonb;
