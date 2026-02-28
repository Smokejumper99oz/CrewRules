-- credit_minutes: trip credit/pay in minutes (HHMM→minutes). Source of truth; no decimal hours.
alter table public.schedule_events
  add column if not exists credit_minutes integer;
