-- Mentors can edit or delete their assignment check-ins (portal).

create policy "Mentors can update mentorship_check_ins for own assignments"
  on public.mentorship_check_ins
  for update
  using (
    exists (
      select 1 from public.mentor_assignments ma
      where ma.id = mentorship_check_ins.assignment_id
        and ma.mentor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.mentor_assignments ma
      where ma.id = mentorship_check_ins.assignment_id
        and ma.mentor_user_id = auth.uid()
    )
  );

create policy "Mentors can delete mentorship_check_ins for own assignments"
  on public.mentorship_check_ins
  for delete
  using (
    exists (
      select 1 from public.mentor_assignments ma
      where ma.id = mentorship_check_ins.assignment_id
        and ma.mentor_user_id = auth.uid()
    )
  );
