-- Pending Frontier pilot signups (email not yet confirmed). Service role only; no RLS policies (same pattern as system_events).

create table if not exists public.pending_signups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  tenant text,
  portal text,
  email_normalized text,
  employee_number text,
  signup_at timestamptz not null default now(),
  confirmed_at timestamptz,
  alert_10m_at timestamptz,
  followup_email_at timestamptz
);

create index if not exists idx_pending_signups_signup_at on public.pending_signups (signup_at desc);

create index if not exists idx_pending_signups_unconfirmed
  on public.pending_signups (signup_at)
  where confirmed_at is null;

alter table public.pending_signups enable row level security;

comment on table public.pending_signups is 'Tracks auth signups awaiting email confirmation; cron alerts and follow-up. Written/read via service role only.';
