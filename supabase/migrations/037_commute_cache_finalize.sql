-- 037_commute_cache_finalize.sql

-- 1) Cache table: add user_id (per-user cache key)
alter table public.commute_flight_cache
  add column if not exists user_id uuid;

-- Table is empty (you confirmed cache_rows=0), so NOT NULL is safe
alter table public.commute_flight_cache
  alter column user_id set not null;

-- 2) Unique constraint: 1 cache per (tenant, user, date, route)
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname='public'
      and t.relname='commute_flight_cache'
      and c.contype='u'
      and pg_get_constraintdef(c.oid) like '%(tenant, user_id, commute_date, origin, destination)%'
  ) then
    alter table public.commute_flight_cache
      add constraint commute_flight_cache_unique
      unique (tenant, user_id, commute_date, origin, destination);
  end if;
end $$;

-- 3) Unique constraint on usage table (if missing) for safety
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname='public'
      and t.relname='commute_refresh_usage_monthly'
      and c.contype='u'
      and pg_get_constraintdef(c.oid) like '%(tenant, user_id, month_start)%'
  ) then
    alter table public.commute_refresh_usage_monthly
      add constraint commute_refresh_usage_monthly_unique
      unique (tenant, user_id, month_start);
  end if;
end $$;

-- 4) RPC: increment monthly usage (service_role only)
create or replace function public.increment_commute_refresh_usage(
  p_tenant text,
  p_user_id uuid,
  p_month_start date
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.commute_refresh_usage_monthly (tenant, user_id, month_start, refresh_count, updated_at)
  values (p_tenant, p_user_id, p_month_start, 1, now())
  on conflict (tenant, user_id, month_start)
  do update set
    refresh_count = public.commute_refresh_usage_monthly.refresh_count + 1,
    updated_at = now();
end;
$$;

revoke all on function public.increment_commute_refresh_usage(text, uuid, date) from public;
grant execute on function public.increment_commute_refresh_usage(text, uuid, date) to service_role;
