-- Fix function_search_path_mutable linter warning (0011)
-- Set explicit search_path on SECURITY DEFINER function to prevent search path injection
create or replace function public.increment_commute_refresh_usage(
  p_tenant text,
  p_user_id uuid,
  p_month_start date
)
returns void
language plpgsql
security definer
set search_path = public
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
