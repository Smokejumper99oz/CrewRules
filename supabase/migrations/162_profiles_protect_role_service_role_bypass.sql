-- Service-role (server admin client) may update profiles.role / tenant / portal;
-- authenticated users still require super_admin or tenant_admin on auth.uid().

create or replace function public.profiles_protect_role_tenant_portal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_admin boolean;
begin
  -- Allow service role (server-side admin) to bypass protection
  if current_setting('request.jwt.claim.role', true) = 'service_role' then
    return new;
  end if;

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

comment on function public.profiles_protect_role_tenant_portal() is 'Prevents non-admins from changing role, tenant, portal. Service role bypasses; otherwise server-only fields.';
