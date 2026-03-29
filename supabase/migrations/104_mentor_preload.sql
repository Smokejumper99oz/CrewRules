-- Preloaded mentor roster before CrewRules signup. Matching logic and triggers are out of scope for this migration.

create table public.mentor_preload (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  portal text,
  employee_number text not null,
  full_name text,
  work_email text,
  personal_email text,
  phone text,
  active boolean not null default true,
  notes text,
  matched_profile_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentor_preload_tenant_employee_number_key unique (tenant, employee_number)
);

comment on table public.mentor_preload is
  'Admin-managed mentor roster before profiles exist or link; matched_profile_id set when claimed.';

comment on column public.mentor_preload.matched_profile_id is
  'Set when preloaded row is linked to public.profiles.id; null until matched.';

create index if not exists mentor_preload_employee_number_idx
  on public.mentor_preload (employee_number);

create index if not exists mentor_preload_matched_profile_id_idx
  on public.mentor_preload (matched_profile_id);

alter table public.mentor_preload enable row level security;

-- super_admin + tenant_admin (own tenant only): full CRUD via is_profile_admin (032)
create policy "Admins can read mentor_preload"
  on public.mentor_preload for select
  using (is_profile_admin(tenant));

create policy "Admins can insert mentor_preload"
  on public.mentor_preload for insert
  with check (is_profile_admin(tenant));

create policy "Admins can update mentor_preload"
  on public.mentor_preload for update
  using (is_profile_admin(tenant))
  with check (is_profile_admin(tenant));

create policy "Admins can delete mentor_preload"
  on public.mentor_preload for delete
  using (is_profile_admin(tenant));
