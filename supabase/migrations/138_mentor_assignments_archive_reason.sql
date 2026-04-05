-- Assignment-level archive reason (nullable). Tight CHECK for known values; no backfill.
-- Replaces mark_mentee_assignment_inactive_by_mentor to set left_frontier when mentor deactivates.

alter table public.mentor_assignments
  add column assignment_archive_reason text
    constraint mentor_assignments_assignment_archive_reason_valid
    check (
      assignment_archive_reason is null
      or assignment_archive_reason in ('left_frontier', 'completed_program')
    );

comment on column public.mentor_assignments.assignment_archive_reason is
  'Why the assignment was archived: e.g. left_frontier, completed_program. Null for legacy inactive rows.';

create or replace function public.mark_mentee_assignment_inactive_by_mentor(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.mentor_assignments
  set
    active = false,
    assignment_archive_reason = 'left_frontier',
    updated_at = now()
  where id = p_assignment_id
    and mentor_user_id = auth.uid();

  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Assignment not found or not authorized';
  end if;
end;
$$;

comment on function public.mark_mentee_assignment_inactive_by_mentor(uuid) is
  'Sets mentor_assignments.active to false and assignment_archive_reason to left_frontier when auth.uid() is the mentor on the assignment.';
