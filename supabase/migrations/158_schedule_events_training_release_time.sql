-- SIM / recurrent training: parsed release end from DESCRIPTION (ICS), stored for commute and display.

alter table public.schedule_events
  add column if not exists training_release_time timestamptz;
