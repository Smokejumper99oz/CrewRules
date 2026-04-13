-- Tenant admin invite tokens: allows the accept-invite page to look up the Supabase
-- action_link without exposing it in email URLs (prevents email scanner pre-consumption).

create table if not exists public.tenant_admin_invite_tokens (
  id uuid primary key default gen_random_uuid(),
  action_link text not null,
  email text not null,
  tenant text not null,
  portal text not null,
  role text not null,
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

-- Service role only; no direct client access needed.
alter table public.tenant_admin_invite_tokens enable row level security;

comment on table public.tenant_admin_invite_tokens is
  'One-time Supabase invite action_links stored server-side so email scanners cannot pre-consume the token. Read/written only via service role.';
