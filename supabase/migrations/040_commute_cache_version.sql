-- 040_commute_cache_version.sql
-- One-time cache purge: add cache_version so old 3-flight entries are ignored.
-- New reads/writes use v2; v1 rows remain but are never read.

alter table public.commute_flight_cache
  add column if not exists cache_version text not null default 'v1';

-- Drop old unique constraint
alter table public.commute_flight_cache
  drop constraint if exists commute_flight_cache_unique;

-- Add new unique constraint including cache_version
alter table public.commute_flight_cache
  add constraint commute_flight_cache_unique
  unique (tenant, user_id, commute_date, origin, destination, cache_version);
