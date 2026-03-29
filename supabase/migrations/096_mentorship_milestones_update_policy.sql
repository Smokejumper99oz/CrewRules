-- Mentor or mentee may update milestone rows for their assignment (e.g. completed_date).
-- Mirrors the EXISTS on mentor_assignments from policy "Users can read mentorship_milestones for own assignments".

create policy "Users can update mentorship_milestones for own assignments"
  on public.mentorship_milestones
  for update
  using (
    exists (
      select 1 from public.mentor_assignments ma
      where ma.id = mentorship_milestones.assignment_id
        and (ma.mentor_user_id = auth.uid() or ma.mentee_user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.mentor_assignments ma
      where ma.id = mentorship_milestones.assignment_id
        and (ma.mentor_user_id = auth.uid() or ma.mentee_user_id = auth.uid())
    )
  );
