-- Add 'pay' to schedule_events.event_type check constraint.
-- PAY events (import-side) must be allowed; stats-side already excludes them by title.

alter table public.schedule_events
  drop constraint if exists schedule_events_event_type_check;

alter table public.schedule_events
  add constraint schedule_events_event_type_check
  check (event_type in ('trip', 'reserve', 'vacation', 'off', 'other', 'pay'));
