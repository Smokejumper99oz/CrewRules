-- Mentor-authored notes per assignment (portal).

create table if not exists public.mentorship_notes (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.mentor_assignments (id) on delete cascade,
  author_user_id uuid not null,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists mentorship_notes_assignment_id_created_at_idx
  on public.mentorship_notes (assignment_id, created_at desc);

comment on table public.mentorship_notes is 'Mentor notes tied to an assignment; author must be the mentor.';

alter table public.mentorship_notes enable row level security;

create policy "Users can read mentorship_notes for own assignments"
  on public.mentorship_notes
  for select
  using (
    exists (
      select 1 from public.mentor_assignments ma
      where ma.id = mentorship_notes.assignment_id
        and (ma.mentor_user_id = auth.uid() or ma.mentee_user_id = auth.uid())
    )
  );

create policy "Mentors can insert mentorship_notes for own assignments"
  on public.mentorship_notes
  for insert
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from public.mentor_assignments ma
      where ma.id = mentorship_notes.assignment_id
        and ma.mentor_user_id = auth.uid()
    )
  );
