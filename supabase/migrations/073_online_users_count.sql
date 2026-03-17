-- Lightweight online user approximation for Super Admin.
-- Counts distinct users with auth sessions refreshed in the last N minutes.
-- Call via RPC from gated Super Admin actions only.

create or replace function public.get_online_users_count(p_minutes integer default 15)
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(distinct user_id)::integer
  from auth.sessions
  where updated_at > now() - (p_minutes || ' minutes')::interval;
$$;

comment on function public.get_online_users_count(integer) is 'Approximate online users: distinct user_ids from auth.sessions with updated_at in last N minutes. Super Admin only.';
