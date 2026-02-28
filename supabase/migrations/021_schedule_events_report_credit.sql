-- Optional report time and credit hours for schedule events (from FLICA ICS DESCRIPTION)
alter table public.schedule_events
  add column if not exists report_time text,
  add column if not exists credit_hours numeric(4,2);
