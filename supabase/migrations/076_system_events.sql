-- Event-driven system issues for Super Admin "Needs Attention" feed.

create table if not exists public.system_events (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- "system", "import", "provider"
  severity text not null, -- "info", "warning", "error"
  title text not null,
  message text not null,
  metadata jsonb,
  dismissed boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_system_events_created_at on public.system_events(created_at desc);
create index if not exists idx_system_events_dismissed on public.system_events(dismissed);

alter table public.system_events enable row level security;
-- No policies: only service role (admin client) can read/write. Super Admin uses admin client.

comment on table public.system_events is 'System issues for Super Admin Needs Attention. Written by app (e.g. email failures); read by Super Admin only.';
