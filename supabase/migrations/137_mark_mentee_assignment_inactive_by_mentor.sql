-- Mentor-only: set mentor_assignments.active = false for own assignment.
-- SECURITY DEFINER so mentors need not receive broad UPDATE on mentor_assignments.
-- Updates only active and updated_at; all authorization is inside the function.

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
  'Sets mentor_assignments.active to false when auth.uid() is the mentor on the assignment.';

revoke all on function public.mark_mentee_assignment_inactive_by_mentor(uuid) from public;
grant execute on function public.mark_mentee_assignment_inactive_by_mentor(uuid) to authenticated;
