-- Family View invites: pilot-owned rows; raw magic-link token is never stored (only SHA-256 hash).
-- Safe if applied after a manual create: IF NOT EXISTS / DROP POLICY IF EXISTS.

create table if not exists public.family_view_invites (
  id uuid primary key default gen_random_uuid(),
  pilot_profile_id uuid not null references public.profiles (id) on delete cascade,
  email text not null,
  token_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'revoked')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Forward-compatible if the table was created manually without updated_at.
alter table public.family_view_invites
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists family_view_invites_one_pending_per_pilot_email_idx
  on public.family_view_invites (pilot_profile_id, lower(email))
  where status = 'pending';

create index if not exists family_view_invites_pilot_created_at_idx
  on public.family_view_invites (pilot_profile_id, created_at desc);

alter table public.family_view_invites enable row level security;

drop policy if exists "Pilots select own family_view_invites" on public.family_view_invites;
create policy "Pilots select own family_view_invites"
  on public.family_view_invites for select
  using (pilot_profile_id = auth.uid());

drop policy if exists "Pilots insert own family_view_invites" on public.family_view_invites;
create policy "Pilots insert own family_view_invites"
  on public.family_view_invites for insert
  with check (pilot_profile_id = auth.uid());

drop policy if exists "Pilots update own family_view_invites" on public.family_view_invites;
create policy "Pilots update own family_view_invites"
  on public.family_view_invites for update
  using (pilot_profile_id = auth.uid())
  with check (pilot_profile_id = auth.uid());

comment on table public.family_view_invites is
  'Family View share invites; store token_hash (SHA-256 of raw secret) only. Pilot-owned via pilot_profile_id = profiles.id = auth.uid().';
