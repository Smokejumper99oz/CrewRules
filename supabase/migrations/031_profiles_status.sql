-- Profiles: status column for pending/disabled gating

alter table public.profiles
  add column if not exists status text not null default 'active'
  check (status in ('active', 'pending', 'disabled'));

comment on column public.profiles.status is 'active: full access; pending: redirect to complete-profile; disabled: deny access.';
