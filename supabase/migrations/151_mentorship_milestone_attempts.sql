create table if not exists public.mentorship_milestone_attempts (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.mentorship_milestones(id) on delete cascade,
  assignment_id uuid not null references public.mentor_assignments(id) on delete cascade,
  milestone_type text not null,
  outcome text not null check (outcome = 'failed'),
  occurred_on date not null,
  note text null,
  created_at timestamptz not null default now()
);

create index if not exists mentorship_milestone_attempts_milestone_idx
  on public.mentorship_milestone_attempts (milestone_id);

create index if not exists mentorship_milestone_attempts_assignment_type_idx
  on public.mentorship_milestone_attempts (assignment_id, milestone_type);

alter table public.mentorship_milestone_attempts enable row level security;

create policy "mentorship_milestone_attempts_select_assignment_users"
  on public.mentorship_milestone_attempts
  for select
  using (
    exists (
      select 1
      from public.mentor_assignments ma
      where ma.id = mentorship_milestone_attempts.assignment_id
        and (
          ma.mentor_user_id = auth.uid()
          or ma.mentee_user_id = auth.uid()
        )
    )
  );

create policy "mentorship_milestone_attempts_insert_mentor_only"
  on public.mentorship_milestone_attempts
  for insert
  with check (
    exists (
      select 1
      from public.mentor_assignments ma
      where ma.id = mentorship_milestone_attempts.assignment_id
        and ma.mentor_user_id = auth.uid()
    )
  );

create policy "mentorship_milestone_attempts_update_mentor_only"
  on public.mentorship_milestone_attempts
  for update
  using (
    exists (
      select 1
      from public.mentor_assignments ma
      where ma.id = mentorship_milestone_attempts.assignment_id
        and ma.mentor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.mentor_assignments ma
      where ma.id = mentorship_milestone_attempts.assignment_id
        and ma.mentor_user_id = auth.uid()
    )
  );

create policy "mentorship_milestone_attempts_delete_mentor_only"
  on public.mentorship_milestone_attempts
  for delete
  using (
    exists (
      select 1
      from public.mentor_assignments ma
      where ma.id = mentorship_milestone_attempts.assignment_id
        and ma.mentor_user_id = auth.uid()
    )
  );

comment on table public.mentorship_milestone_attempts is
  'Failed milestone attempts only. Does not replace mentorship_milestones completion flow.';
comment on column public.mentorship_milestone_attempts.outcome is
  'Currently supports only failed attempts; passed milestones remain tracked by mentorship_milestones.completed_date.';
comment on column public.mentorship_milestone_attempts.occurred_on is
  'Date the failed attempt occurred.';
