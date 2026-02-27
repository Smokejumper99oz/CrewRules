-- Add crew_role to profiles: pilot | flight_attendant (crew type, distinct from role=admin|member)
-- Run in Supabase SQL Editor after 012

alter table public.profiles
  add column if not exists crew_role text not null default 'pilot'
  check (crew_role in ('pilot', 'flight_attendant'));

comment on column public.profiles.crew_role is 'Crew type: pilot or flight_attendant. Distinct from role (admin/member permission level).';


-- Update handle_new_user to set crew_role (default pilot; FA signup will set flight_attendant later)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, tenant, portal, role, crew_role)
  values (new.id, new.email, 'frontier', 'pilots', 'member', 'pilot');
  return new;
end;
$$;
