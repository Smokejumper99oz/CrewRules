-- Full-trip protected paid credit (e.g. from FLICA PAY marker rolled onto the following pairing row). Month Overview uses this when set; PAY rows stay markers only.
alter table public.schedule_events
  add column if not exists protected_full_trip_paid_minutes integer null;
