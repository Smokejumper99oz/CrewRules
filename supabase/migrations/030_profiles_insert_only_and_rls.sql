-- Profiles: INSERT-only trigger, protect role/tenant/portal, RLS hardening
-- Prevents profiles from being overwritten on create/invite. Roles server-only.

-- 1. handle_new_user: INSERT-ONLY, minimal row if missing, NEVER update existing
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r text := coalesce(nullif(trim(new.raw_user_meta_data->>'role'), ''), 'pilot');
  t text := coalesce(nullif(trim(new.raw_user_meta_data->>'tenant'), ''), 'frontier');
  p text := coalesce(nullif(trim(new.raw_user_meta_data->>'portal'), ''), 'pilots');
begin
  if r not in ('super_admin', 'tenant_admin', 'pilot', 'flight_attendant') then
    r := 'pilot';
  end if;
  insert into public.profiles (id, email, tenant, portal, role, plan)
  values (
    new.id,
    coalesce(new.email, ''),
    t,
    p,
    r,
    coalesce(nullif(trim(new.raw_user_meta_data->>'plan'), ''), 'free')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is 'INSERT-only: creates minimal profile when auth user is created. ON CONFLICT (id) DO NOTHING - never updates existing rows.';

-- 2. Trigger: non-admins cannot change role, tenant, portal on their own profile
create or replace function public.profiles_protect_role_tenant_portal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_admin boolean;
begin
  if old.id = new.id and old.role = new.role and old.tenant = new.tenant and old.portal = new.portal then
    return new;
  end if;
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('super_admin', 'tenant_admin')
  ) into is_admin;
  if not is_admin then
    new.role := old.role;
    new.tenant := old.tenant;
    new.portal := old.portal;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role_tenant_portal_trigger on public.profiles;
create trigger profiles_protect_role_tenant_portal_trigger
  before update on public.profiles
  for each row
  execute function public.profiles_protect_role_tenant_portal();

comment on function public.profiles_protect_role_tenant_portal() is 'Prevents non-admins from changing role, tenant, portal. Server-only fields.';

-- 3. RLS summary (policies from 004 + 029 remain; trigger enforces role/tenant/portal protection)
-- Users: SELECT own row, UPDATE own row (trigger blocks role/tenant/portal changes)
-- Admins: SELECT/UPDATE profiles in same tenant (029)
-- All profile operations key by id only; never by email.
