-- Mentor-only quick workspace per assignment (status, private note, next check-in).
-- Not visible to mentees via RLS.

create table if not exists public.mentorship_mentor_workspace (
  assignment_id uuid primary key references public.mentor_assignments (id) on delete cascade,
  mentoring_status text not null default 'Active'
    check (
      mentoring_status in (
        'Active',
        'Needs Check-In',
        'On Track',
        'Military Leave',
        'Paused',
        'Needs Support'
      )
    ),
  private_note text not null default '',
  next_check_in_date date null,
  updated_at timestamptz not null default now()
);

comment on table public.mentorship_mentor_workspace is 'Mentor-editable mentoring status, private note, and next check-in; one row per assignment; mentees cannot read.';

create index if not exists mentorship_mentor_workspace_updated_at_idx
  on public.mentorship_mentor_workspace (updated_at desc);

alter table public.mentorship_mentor_workspace enable row level security;

create policy "Mentors read workspace for own assignments"
  on public.mentorship_mentor_workspace
  for select
  using (
    exists (
      select 1 from public.mentor_assignments ma
      where ma.id = mentorship_mentor_workspace.assignment_id
        and ma.mentor_user_id = auth.uid()
    )
  );

create policy "Mentors insert workspace for own assignments"
  on public.mentorship_mentor_workspace
  for insert
  with check (
    exists (
      select 1 from public.mentor_assignments ma
      where ma.id = mentorship_mentor_workspace.assignment_id
        and ma.mentor_user_id = auth.uid()
    )
  );

create policy "Mentors update workspace for own assignments"
  on public.mentorship_mentor_workspace
  for update
  using (
    exists (
      select 1 from public.mentor_assignments ma
      where ma.id = mentorship_mentor_workspace.assignment_id
        and ma.mentor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.mentor_assignments ma
      where ma.id = mentorship_mentor_workspace.assignment_id
        and ma.mentor_user_id = auth.uid()
    )
  );
