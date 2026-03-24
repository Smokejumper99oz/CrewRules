-- 080_commute_cache_create_if_missing.sql
--
-- Ensures commute_flight_cache and commute_refresh_usage_monthly exist with the
-- correct schema. Migrations 037 and 040 only ALTER these tables; the original
-- CREATE TABLE was done in the Supabase dashboard and never committed.
-- All statements are idempotent (IF NOT EXISTS / DO $$ blocks).

-- ─── commute_flight_cache ────────────────────────────────────────────────────

create table if not exists public.commute_flight_cache (
  id             uuid        primary key default gen_random_uuid(),
  tenant         text        not null,
  user_id        uuid        not null,
  origin         text        not null,
  destination    text        not null,
  commute_date   text        not null,
  cache_version  text        not null default 'v1',
  data           jsonb,
  fetched_at     timestamptz,
  created_at     timestamptz not null default now()
);

-- Add user_id if missing (migration 037 may not have run)
alter table public.commute_flight_cache
  add column if not exists user_id uuid;

-- Add cache_version if missing (migration 040 may not have run)
alter table public.commute_flight_cache
  add column if not exists cache_version text not null default 'v1';

-- Ensure unique constraint includes cache_version.
-- Drop old constraint (without cache_version) first if present, then add new one.
do $$
begin
  -- Drop old constraint if it lacks cache_version
  if exists (
    select 1
    from   pg_constraint c
    join   pg_class t     on t.oid = c.conrelid
    join   pg_namespace n on n.oid = t.relnamespace
    where  n.nspname = 'public'
      and  t.relname = 'commute_flight_cache'
      and  c.conname = 'commute_flight_cache_unique'
      and  pg_get_constraintdef(c.oid) not like '%cache_version%'
  ) then
    alter table public.commute_flight_cache
      drop constraint commute_flight_cache_unique;
  end if;

  -- Add correct constraint if missing
  if not exists (
    select 1
    from   pg_constraint c
    join   pg_class t     on t.oid = c.conrelid
    join   pg_namespace n on n.oid = t.relnamespace
    where  n.nspname = 'public'
      and  t.relname = 'commute_flight_cache'
      and  c.conname = 'commute_flight_cache_unique'
  ) then
    alter table public.commute_flight_cache
      add constraint commute_flight_cache_unique
      unique (tenant, user_id, commute_date, origin, destination, cache_version);
  end if;
end $$;

alter table public.commute_flight_cache enable row level security;

-- Service role bypasses RLS; no additional policies needed for admin writes.

-- ─── commute_refresh_usage_monthly ──────────────────────────────────────────

create table if not exists public.commute_refresh_usage_monthly (
  id             uuid  primary key default gen_random_uuid(),
  tenant         text  not null,
  user_id        uuid  not null,
  month_start    date  not null,
  refresh_count  int   not null default 0,
  updated_at     timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from   pg_constraint c
    join   pg_class t     on t.oid = c.conrelid
    join   pg_namespace n on n.oid = t.relnamespace
    where  n.nspname = 'public'
      and  t.relname = 'commute_refresh_usage_monthly'
      and  c.conname = 'commute_refresh_usage_monthly_unique'
  ) then
    alter table public.commute_refresh_usage_monthly
      add constraint commute_refresh_usage_monthly_unique
      unique (tenant, user_id, month_start);
  end if;
end $$;

alter table public.commute_refresh_usage_monthly enable row level security;
