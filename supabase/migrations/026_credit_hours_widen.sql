-- credit_hours: widen to support computed trip credit (pairing_days * 5 hrs can exceed 99.99)
alter table public.schedule_events
  alter column credit_hours type numeric(6,2) using credit_hours::numeric(6,2);
