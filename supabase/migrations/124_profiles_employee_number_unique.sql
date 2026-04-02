-- One non-empty (trimmed) employee_number per tenant + portal on profiles.
-- Matches app checks that use trimmed employee numbers.

create unique index if not exists profiles_tenant_portal_btrim_employee_number_uidx
  on public.profiles (tenant, portal, (btrim(employee_number)))
  where employee_number is not null
    and btrim(employee_number) <> '';

comment on index public.profiles_tenant_portal_btrim_employee_number_uidx is
  'Prevents two profiles in the same tenant+portal from sharing the same trimmed employee_number.';

-- SECURITY DEFINER: RLS would block cross-profile reads for conflict checks.
create or replace function public.profiles_employee_number_is_taken(
  p_tenant text,
  p_portal text,
  p_employee_number text,
  p_exclude_profile_id uuid default null
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.tenant = p_tenant
      and p.portal = p_portal
      and p.employee_number is not null
      and btrim(p.employee_number) <> ''
      and btrim(p.employee_number) = btrim(p_employee_number)
      and (p_exclude_profile_id is null or p.id <> p_exclude_profile_id)
  );
$$;

comment on function public.profiles_employee_number_is_taken(text, text, text, uuid) is
  'True if a profile row already uses this trimmed employee_number for the tenant+portal (excluding id when set).';

grant execute on function public.profiles_employee_number_is_taken(text, text, text, uuid) to authenticated;
grant execute on function public.profiles_employee_number_is_taken(text, text, text, uuid) to service_role;
