-- Run this in Supabase SQL Editor to fix the RLS security warning
-- Replaces the permissive "WITH CHECK (true)" policy with validation

drop policy if exists "Allow anonymous inserts" on access_requests;

create policy "Allow anonymous inserts with valid email"
  on access_requests for insert
  with check (
    email is not null
    and length(trim(email)) >= 5
    and length(trim(email)) <= 255
    and email ~* '^[^@]+@[^@]+\.[^@]+$'
  );
