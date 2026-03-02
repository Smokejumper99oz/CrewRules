-- Tenant-level settings (e.g. pay scale, bid period, reserve credit).
-- portal = null means setting applies to all portals in the tenant.
-- Uses is_profile_admin() for RLS (032); only admins read/write for now.

create table if not exists public.tenant_settings (
  tenant text not null,
  portal text,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Unique: (tenant, portal, key) when portal is set; (tenant, key) when portal is null
create unique index if not exists tenant_settings_tenant_portal_key_key
  on public.tenant_settings (tenant, portal, key)
  where portal is not null;

create unique index if not exists tenant_settings_tenant_key_key
  on public.tenant_settings (tenant, key)
  where portal is null;

comment on table public.tenant_settings is 'Tenant-level configuration. portal=null applies to all portals.';

-- Auto-update updated_at on row update
create or replace function public.tenant_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tenant_settings_updated_at_trigger on public.tenant_settings;
create trigger tenant_settings_updated_at_trigger
  before update on public.tenant_settings
  for each row
  execute function public.tenant_settings_updated_at();

alter table public.tenant_settings enable row level security;

-- Read: only tenant_admin and super_admin (expand to tenant users later)
create policy "Admins can read tenant_settings"
  on public.tenant_settings for select
  using (is_profile_admin(tenant));

-- Write: only tenant_admin and super_admin
create policy "Admins can insert tenant_settings"
  on public.tenant_settings for insert
  with check (is_profile_admin(tenant));

create policy "Admins can update tenant_settings"
  on public.tenant_settings for update
  using (is_profile_admin(tenant))
  with check (is_profile_admin(tenant));

create policy "Admins can delete tenant_settings"
  on public.tenant_settings for delete
  using (is_profile_admin(tenant));
