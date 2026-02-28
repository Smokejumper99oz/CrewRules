-- Fix infinite recursion in profiles RLS: admin policies query profiles, triggering RLS again.
-- Use a SECURITY DEFINER helper that bypasses RLS to check admin status.

create or replace function public.is_profile_admin(check_tenant text default null)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('super_admin', 'tenant_admin')
    and (
      role = 'super_admin'
      or (role = 'tenant_admin' and (check_tenant is null or tenant = check_tenant))
    )
  );
$$;

comment on function public.is_profile_admin(text) is 'Bypasses RLS to check if current user is super_admin or tenant_admin for tenant. Use in policies to avoid recursion.';

-- Replace recursive admin policies with function-based checks
-- (Users can read/update own profile from 004 remain unchanged)
drop policy if exists "Admins can read tenant profiles" on public.profiles;
create policy "Admins can read tenant profiles"
  on public.profiles for select
  using (is_profile_admin(profiles.tenant));

drop policy if exists "Admins can update tenant profiles" on public.profiles;
create policy "Admins can update tenant profiles"
  on public.profiles for update
  using (is_profile_admin(profiles.tenant))
  with check (is_profile_admin(profiles.tenant));
