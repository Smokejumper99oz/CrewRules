-- Add full_name to waitlist for non-Frontier signups

alter table public.waitlist
  add column if not exists full_name text;
