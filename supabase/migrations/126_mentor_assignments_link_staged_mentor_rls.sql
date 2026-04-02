-- Allow mentors to read and claim staged rows (mentor_user_id null, mentor_employee_number set).
-- App: lib/mentoring/link-mentor-to-assignments.ts

drop policy if exists "Users can read own mentor_assignments" on public.mentor_assignments;

create policy "Users can read own mentor_assignments"
  on public.mentor_assignments for select
  using (
    auth.uid() = mentor_user_id
    or auth.uid() = mentee_user_id
    or (
      mentor_user_id is null
      and mentor_employee_number is not null
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
        and btrim(coalesce(p.employee_number, '')) = btrim(mentor_assignments.mentor_employee_number)
      )
    )
  );

drop policy if exists "Mentor can link assignment by mentor_employee_number" on public.mentor_assignments;

create policy "Mentor can link assignment by mentor_employee_number"
  on public.mentor_assignments for update
  using (
    mentor_user_id is null
    and mentor_employee_number is not null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and btrim(coalesce(p.employee_number, '')) = btrim(mentor_assignments.mentor_employee_number)
    )
  )
  with check (mentor_user_id = auth.uid());
