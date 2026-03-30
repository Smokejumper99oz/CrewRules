-- Mentor-facing mentee detail: read ONLY profiles.base_airport when caller is the assignment mentor.
-- SECURITY DEFINER bypasses profiles RLS for this narrow field; auth check ties row to auth.uid() as mentor.

create or replace function public.get_mentee_base_airport_for_mentor(p_assignment_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select p.base_airport
  from public.mentor_assignments ma
  inner join public.profiles p on p.id = ma.mentee_user_id
  where ma.id = p_assignment_id
    and ma.mentor_user_id = auth.uid()
    and ma.mentee_user_id is not null
  limit 1;
$$;

comment on function public.get_mentee_base_airport_for_mentor(uuid) is
  'Returns mentee profiles.base_airport for mentoring detail when auth.uid() is the mentor on the assignment.';

revoke all on function public.get_mentee_base_airport_for_mentor(uuid) from public;
grant execute on function public.get_mentee_base_airport_for_mentor(uuid) to authenticated;
