-- V1.1: mentee may DELETE only their own latest row per (assignment_id, milestone_type).

create policy "Mentees delete own latest milestone update per type"
  on public.mentorship_mentee_milestone_updates
  for delete
  using (
    author_user_id = auth.uid()
    and exists (
      select 1
      from public.mentor_assignments ma
      where ma.id = mentorship_mentee_milestone_updates.assignment_id
        and ma.mentee_user_id = auth.uid()
    )
    and id = (
      select u2.id
      from public.mentorship_mentee_milestone_updates u2
      where u2.assignment_id = mentorship_mentee_milestone_updates.assignment_id
        and u2.milestone_type = mentorship_mentee_milestone_updates.milestone_type
      order by u2.created_at desc, u2.id desc
      limit 1
    )
  );
