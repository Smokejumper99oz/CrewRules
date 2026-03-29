-- Mentoring check-in milestones per assignment (seeded after CSV import / assignment upsert).

create table if not exists public.mentorship_milestones (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.mentor_assignments (id) on delete cascade,
  milestone_type text not null,
  due_date date not null,
  completed_date date null,
  created_at timestamptz not null default now()
);

create unique index if not exists mentorship_milestones_assignment_id_milestone_type_key
  on public.mentorship_milestones (assignment_id, milestone_type);

comment on table public.mentorship_milestones is 'Program milestones for a mentor assignment; due/completed dates drive portal timeline.';

alter table public.mentorship_milestones enable row level security;

create policy "Users can read mentorship_milestones for own assignments"
  on public.mentorship_milestones
  for select
  using (
    exists (
      select 1 from public.mentor_assignments ma
      where ma.id = mentorship_milestones.assignment_id
        and (ma.mentor_user_id = auth.uid() or ma.mentee_user_id = auth.uid())
    )
  );
