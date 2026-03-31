-- Mentee-submitted milestone progress updates (V1: type_rating, oe_complete only).
-- Mentors read only; no update/delete policies in V1.

create table if not exists public.mentorship_mentee_milestone_updates (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.mentor_assignments (id) on delete cascade,
  author_user_id uuid not null references auth.users (id) on delete cascade,
  milestone_type text not null
    check (milestone_type in ('type_rating', 'oe_complete')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists mentorship_mentee_milestone_updates_assignment_type_created_idx
  on public.mentorship_mentee_milestone_updates (assignment_id, milestone_type, created_at desc);

comment on table public.mentorship_mentee_milestone_updates is
  'Mentee-authored updates for type_rating / oe_complete; visible to mentor and authoring mentee on the assignment.';

alter table public.mentorship_mentee_milestone_updates enable row level security;

create policy "Mentees insert milestone updates for own assignments"
  on public.mentorship_mentee_milestone_updates
  for insert
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from public.mentor_assignments ma
      where ma.id = mentorship_mentee_milestone_updates.assignment_id
        and ma.mentee_user_id = auth.uid()
    )
  );

create policy "Mentees select milestone updates for own assignments"
  on public.mentorship_mentee_milestone_updates
  for select
  using (
    exists (
      select 1 from public.mentor_assignments ma
      where ma.id = mentorship_mentee_milestone_updates.assignment_id
        and ma.mentee_user_id = auth.uid()
    )
  );

create policy "Mentors select milestone updates for own assignments"
  on public.mentorship_mentee_milestone_updates
  for select
  using (
    exists (
      select 1 from public.mentor_assignments ma
      where ma.id = mentorship_mentee_milestone_updates.assignment_id
        and ma.mentor_user_id = auth.uid()
    )
  );
