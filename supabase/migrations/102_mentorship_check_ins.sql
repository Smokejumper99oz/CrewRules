-- Mentor check-ins (note + date) on an assignment; shown on milestone timeline.

create table if not exists public.mentorship_check_ins (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.mentor_assignments (id) on delete cascade,
  occurred_on date not null,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists mentorship_check_ins_assignment_occurred_idx
  on public.mentorship_check_ins (assignment_id, occurred_on asc, created_at asc);

comment on table public.mentorship_check_ins is 'Mentor log of check-ins; date may align with a milestone due date for inline display.';

alter table public.mentorship_check_ins enable row level security;

create policy "Users can read mentorship_check_ins for own assignments"
  on public.mentorship_check_ins
  for select
  using (
    exists (
      select 1 from public.mentor_assignments ma
      where ma.id = mentorship_check_ins.assignment_id
        and (ma.mentor_user_id = auth.uid() or ma.mentee_user_id = auth.uid())
    )
  );

create policy "Mentors can insert mentorship_check_ins for own assignments"
  on public.mentorship_check_ins
  for insert
  with check (
    exists (
      select 1 from public.mentor_assignments ma
      where ma.id = mentorship_check_ins.assignment_id
        and ma.mentor_user_id = auth.uid()
    )
  );
