-- AviationStack API usage tracking for Super Admin cost reporting.
-- Server-side inserts via service role; no anon/authenticated access.
create table if not exists public.aviationstack_usage (
  id uuid primary key default gen_random_uuid(),
  requested_at timestamptz not null default now(),
  user_id uuid null,
  tenant text null,
  endpoint text null,
  request_count integer not null default 1
);

create index if not exists idx_aviationstack_usage_requested_at
  on public.aviationstack_usage (requested_at);

alter table public.aviationstack_usage enable row level security;

create policy "aviationstack_usage_service_role_only"
  on public.aviationstack_usage
  for all
  using (false)
  with check (false);
