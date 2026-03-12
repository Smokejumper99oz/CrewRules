-- Allow super_admin to read waitlist entries

create policy "Super admin can read waitlist"
  on public.waitlist for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'super_admin'
    )
  );
