-- Allow super_admin to update waitlist entries (e.g. status)

create policy "Super admin can update waitlist"
  on public.waitlist for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'super_admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'super_admin'
    )
  );
