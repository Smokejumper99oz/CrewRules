-- Fix RLS: Replace permissive waitlist INSERT policy with validation
-- Addresses: rls_policy_always_true (0024_permissive_rls_policy)
-- The policy "Allow public waitlist signup" with WITH CHECK (true) bypasses RLS for anon.

drop policy if exists "Allow public waitlist signup" on public.waitlist;
drop policy if exists "Allow anonymous inserts" on public.waitlist;

create policy "Allow anonymous inserts"
  on public.waitlist for insert
  with check (
    email is not null
    and length(trim(email)) >= 5
    and length(trim(email)) <= 255
    and email ~* '^[^@]+@[^@]+\.[^@]+$'
  );
