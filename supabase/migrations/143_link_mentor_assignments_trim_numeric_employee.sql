-- Fix mentee/mentor claiming: app used .eq(employee_number) (exact) while RLS uses btrim match.
-- Also treat all-numeric employee numbers as equal when numeric value matches (e.g. 01234 vs 1234).

create or replace function public.link_mentee_assignments_for_authenticated_user()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_emp text;
  n int := 0;
begin
  if v_uid is null then
    return 0;
  end if;

  select btrim(coalesce(employee_number, '')) into v_emp
  from profiles
  where id = v_uid;

  if v_emp = '' then
    return 0;
  end if;

  update mentor_assignments ma
  set mentee_user_id = v_uid
  where ma.mentee_user_id is null
    and ma.employee_number is not null
    and (
      btrim(ma.employee_number) = v_emp
      or (
        v_emp ~ '^[0-9]+$'
        and btrim(ma.employee_number) ~ '^[0-9]+$'
        and v_emp::bigint = btrim(ma.employee_number)::bigint
      )
    );

  get diagnostics n = row_count;
  return n;
end;
$$;

comment on function public.link_mentee_assignments_for_authenticated_user() is
  'Sets mentee_user_id = auth.uid() on pending mentor_assignments where mentee employee # matches profile (btrim + numeric equality for digit-only).';

create or replace function public.link_mentor_assignments_for_authenticated_user()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_emp text;
  n int := 0;
begin
  if v_uid is null then
    return 0;
  end if;

  select btrim(coalesce(employee_number, '')) into v_emp
  from profiles
  where id = v_uid;

  if v_emp = '' then
    return 0;
  end if;

  update mentor_assignments ma
  set mentor_user_id = v_uid
  where ma.mentor_user_id is null
    and ma.mentor_employee_number is not null
    and (
      btrim(ma.mentor_employee_number) = v_emp
      or (
        v_emp ~ '^[0-9]+$'
        and btrim(ma.mentor_employee_number) ~ '^[0-9]+$'
        and v_emp::bigint = btrim(ma.mentor_employee_number)::bigint
      )
    );

  get diagnostics n = row_count;
  return n;
end;
$$;

comment on function public.link_mentor_assignments_for_authenticated_user() is
  'Sets mentor_user_id = auth.uid() on staged mentor_assignments where mentor_employee_number matches profile (btrim + numeric equality for digit-only).';

revoke all on function public.link_mentee_assignments_for_authenticated_user() from public;
revoke all on function public.link_mentor_assignments_for_authenticated_user() from public;
grant execute on function public.link_mentee_assignments_for_authenticated_user() to authenticated;
grant execute on function public.link_mentor_assignments_for_authenticated_user() to authenticated;
