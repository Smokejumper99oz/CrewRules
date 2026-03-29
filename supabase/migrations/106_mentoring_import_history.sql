-- Audit trail for mentee bulk imports (CSV/XLSX). Inserts use service role from server actions.

create table public.mentoring_import_history (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  uploaded_by_user_id uuid not null,
  file_name text not null,
  file_type text not null check (file_type in ('csv', 'xlsx')),
  total_rows int not null default 0,
  success_count int not null default 0,
  created_count int not null default 0,
  updated_count int not null default 0,
  failed_count int not null default 0,
  fatal_error text,
  row_results jsonb,
  created_at timestamptz not null default now()
);

comment on table public.mentoring_import_history is
  'One row per mentee mentoring bulk import run (Frontier tenant admin or Super Admin upload).';

create index if not exists mentoring_import_history_tenant_created_at_idx
  on public.mentoring_import_history (tenant, created_at desc);

alter table public.mentoring_import_history enable row level security;

create policy "Admins can read mentoring import history for tenant"
  on public.mentoring_import_history for select
  using (is_profile_admin(tenant));
