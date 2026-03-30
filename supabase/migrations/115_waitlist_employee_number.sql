-- Add employee_number to waitlist (matches request-access upsert payload)

alter table public.waitlist
  add column if not exists employee_number text;
