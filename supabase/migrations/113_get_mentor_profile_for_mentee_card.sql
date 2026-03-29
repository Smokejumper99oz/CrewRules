-- Mentee-facing mentor card: PostgREST embed of mentor profiles can come back null under RLS/embed edge cases.
-- This RPC returns only fields shown on the shared mentoring card; callable only when auth.uid() is the
-- active mentee on an assignment with the given mentor.

create or replace function public.get_mentor_profile_for_mentee_card(p_mentor_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'full_name', p.full_name,
    'position', p.position,
    'base_airport', p.base_airport,
    'home_airport', p.home_airport,
    'date_of_hire', p.date_of_hire,
    'phone', p.phone,
    'mentor_phone', p.mentor_phone,
    'mentor_contact_email', p.mentor_contact_email,
    'tenant', p.tenant,
    'portal', p.portal,
    'role', p.role,
    'is_admin', p.is_admin,
    'is_mentor', p.is_mentor
  )
  from public.profiles p
  where p.id = p_mentor_user_id
    and exists (
      select 1
      from public.mentor_assignments ma
      where ma.mentor_user_id = p_mentor_user_id
        and ma.mentee_user_id = auth.uid()
        and ma.active is true
    );
$$;

comment on function public.get_mentor_profile_for_mentee_card(uuid) is
  'Limited mentor profile JSON for mentee mentoring UI; requires active assignment as mentee.';

revoke all on function public.get_mentor_profile_for_mentee_card(uuid) from public;
grant execute on function public.get_mentor_profile_for_mentee_card(uuid) to authenticated;
