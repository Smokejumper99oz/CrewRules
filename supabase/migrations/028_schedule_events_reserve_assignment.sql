-- is_reserve_assignment: trip from short-call reserve (RSA/RSB/etc). Credit = 4 hrs/day, no block.
alter table public.schedule_events
  add column if not exists is_reserve_assignment boolean default false;
