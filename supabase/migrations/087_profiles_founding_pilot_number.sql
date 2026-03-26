-- Permanent Founding Pilot seat number (1..CAP). Assigned once via Stripe webhook RPC; never cleared.
-- CAP must match lib/founding-pilot-constants.ts FOUNDING_PILOT_CAP (100).

alter table public.profiles
  add column if not exists founding_pilot_number integer null;

comment on column public.profiles.founding_pilot_number is 'Permanent Founding Pilot sequence number (1..100). Set once by claim_founding_pilot_number; not cleared on cancellation.';

create unique index if not exists profiles_founding_pilot_number_key
  on public.profiles (founding_pilot_number)
  where founding_pilot_number is not null;

create or replace function public.claim_founding_pilot_number(p_profile_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing integer;
  v_is_founding boolean;
  v_next integer;
  v_cap constant integer := 100;
begin
  select founding_pilot_number, is_founding_pilot
    into v_existing, v_is_founding
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  if v_existing is not null then
    return v_existing;
  end if;

  if v_is_founding is not true then
    raise exception 'profile_not_founding_pilot';
  end if;

  perform pg_advisory_xact_lock(87201401);

  select coalesce(max(founding_pilot_number), 0) + 1 into v_next
  from public.profiles
  where founding_pilot_number is not null;

  if v_next > v_cap then
    raise exception 'founding_pilot_numbers_exhausted';
  end if;

  update public.profiles
  set founding_pilot_number = v_next
  where id = p_profile_id
    and founding_pilot_number is null;

  return v_next;
end;
$$;

comment on function public.claim_founding_pilot_number(uuid) is
  'Serializes assignment of founding_pilot_number (max+1, cap 100). Idempotent if already set. Requires is_founding_pilot; uses row lock + advisory xact lock.';

revoke all on function public.claim_founding_pilot_number(uuid) from public;
grant execute on function public.claim_founding_pilot_number(uuid) to service_role;
