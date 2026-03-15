-- FlightAware API usage tracking for Super Admin cost reporting.
-- Server-side inserts via service role; no RLS required.
create table if not exists public.flightaware_usage (
  id uuid primary key default gen_random_uuid(),
  requested_at timestamptz not null default now(),
  user_id uuid null,
  tenant text null,
  ident text not null,
  request_count integer not null default 1
);

create index if not exists idx_flightaware_usage_requested_at
  on public.flightaware_usage (requested_at);

create index if not exists idx_flightaware_usage_user_id
  on public.flightaware_usage (user_id);

create index if not exists idx_flightaware_usage_tenant
  on public.flightaware_usage (tenant);
