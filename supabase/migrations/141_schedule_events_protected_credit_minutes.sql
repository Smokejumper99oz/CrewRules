-- Trip rows: credit paid above sequence (disrupted pairing) for Month Overview alignment with payroll.
alter table public.schedule_events
  add column if not exists protected_credit_minutes integer not null default 0;
