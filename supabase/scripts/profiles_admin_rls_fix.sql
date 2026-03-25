-- Run in Supabase Dashboard → SQL Editor (or psql against the project DB).
-- Fixes infinite recursion: admin policies must use SECURITY DEFINER is_profile_admin,
-- not EXISTS (SELECT … FROM profiles …) inside policies on profiles.

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

comment on function public.is_profile_admin(text)
is 'Bypasses RLS to check if current user is super_admin or tenant_admin for tenant. Use in policies to avoid recursion.';

drop policy if exists "Admins can read tenant profiles" on public.profiles;
create policy "Admins can read tenant profiles"
  on public.profiles for select
  using (public.is_profile_admin(profiles.tenant));

drop policy if exists "Admins can update tenant profiles" on public.profiles;
create policy "Admins can update tenant profiles"
  on public.profiles for update
  using (public.is_profile_admin(profiles.tenant))
  with check (public.is_profile_admin(profiles.tenant));
