-- Migration 145: tenant_features
-- Per-tenant feature flags. Super Admin toggles these to unlock Enterprise features.
-- Admin portal UI reads these to show/hide feature sections.

create table if not exists public.tenant_features (
  id           uuid        not null default gen_random_uuid() primary key,
  tenant       text        not null,
  portal       text        not null default 'pilots',
  feature_key  text        not null,
  enabled      boolean     not null default false,
  notes        text,
  enabled_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant, portal, feature_key)
);

comment on table public.tenant_features is
  'Per-tenant feature flags. Toggled by Super Admin to unlock Enterprise capabilities. Admin portal reads these to gate sections.';

comment on column public.tenant_features.feature_key is
  'Stable key identifying the feature. Known keys: mentoring, pilot_to_pilot, advanced_analytics, scheduling_tools.';

create index if not exists tenant_features_tenant_portal_idx
  on public.tenant_features (tenant, portal);

-- updated_at trigger
create or replace function public.set_tenant_features_updated_at()
returns trigger language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenant_features_set_updated_at
  before update on public.tenant_features
  for each row execute function public.set_tenant_features_updated_at();

-- RLS: all reads/writes go through the service-role admin client (bypasses RLS).
-- The policy below satisfies the linter and makes the intent explicit —
-- no regular authenticated user should access this table directly.
alter table public.tenant_features enable row level security;

create policy "Super admins can read tenant_features"
  on public.tenant_features
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'super_admin'
    )
  );

-- Seed Frontier Airlines with their active features
insert into public.tenant_features (tenant, portal, feature_key, enabled, notes, enabled_at)
values
  ('frontier', 'pilots', 'mentoring',           true,  'Core ALPA NH Mentorship Program',          now()),
  ('frontier', 'pilots', 'pilot_to_pilot',       false, 'Pilot-to-Pilot communication module',      null),
  ('frontier', 'pilots', 'advanced_analytics',   false, 'Advanced mentoring and engagement reports', null),
  ('frontier', 'pilots', 'scheduling_tools',     false, 'Bulk scheduling and roster management',     null)
on conflict (tenant, portal, feature_key) do nothing;
