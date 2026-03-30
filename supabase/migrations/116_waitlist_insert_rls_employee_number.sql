-- Optional employee_number: allow null; if present, require at least 3 trimmed characters

drop policy if exists "Allow anonymous inserts" on public.waitlist;

create policy "Allow anonymous inserts"
  on public.waitlist for insert
  with check (
    email is not null
    and length(trim(email)) >= 5
    and length(trim(email)) <= 255
    and email ~* '^[^@]+@[^@]+\.[^@]+$'
    and (
      employee_number is null
      or length(trim(employee_number)) >= 3
    )
  );
