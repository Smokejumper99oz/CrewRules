-- Audit trail for mentor preload bulk imports (CSV/XLSX). Inserts use service role from server actions.

create table public.mentor_preload_import_history (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  uploaded_by_user_id uuid not null,
  file_name text not null,
  file_type text not null check (file_type in ('csv', 'xlsx')),
  total_rows int not null,
  success_count int not null,
  failed_count int not null,
  row_results jsonb,
  fatal_error text,
  created_at timestamptz not null default now()
);

comment on table public.mentor_preload_import_history is
  'One row per mentor preload bulk import run (e.g. Frontier pilots tenant admin).';

create index if not exists mentor_preload_import_history_tenant_created_at_idx
  on public.mentor_preload_import_history (tenant, created_at desc);

alter table public.mentor_preload_import_history enable row level security;

create policy "Admins can read mentor preload import history for tenant"
  on public.mentor_preload_import_history for select
  using (is_profile_admin(tenant));
