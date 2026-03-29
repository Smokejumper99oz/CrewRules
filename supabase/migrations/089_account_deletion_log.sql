-- Audit trail for account deletion finalization (service role writes).
-- status: in_progress | success | failed

create table if not exists public.account_deletion_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  email text null,
  scheduled_for timestamptz null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  status text not null,
  error text null,
  deleted_auth_user boolean not null default false,
  deleted_commute_cache_count integer not null default 0,
  deleted_commute_refresh_usage_monthly_count integer not null default 0,
  deleted_inbound_aliases_count integer not null default 0,
  deleted_inbound_events_count integer not null default 0
);

create index if not exists idx_account_deletion_log_started_at
  on public.account_deletion_log (started_at desc);

create index if not exists idx_account_deletion_log_user_id
  on public.account_deletion_log (user_id);

comment on table public.account_deletion_log is
  'Append/update style log for finalizePendingAccountDeletion. No FK to auth.users or profiles.';

alter table public.account_deletion_log enable row level security;
-- No policies: service role bypasses RLS for writes; Super Admin reads via admin client if needed.
