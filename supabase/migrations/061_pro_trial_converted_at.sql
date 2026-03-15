-- Pro trial conversion tracking: exact timestamp when user converts from free trial to paid Pro/Enterprise.

alter table public.profiles
  add column if not exists pro_trial_converted_at timestamptz null;

comment on column public.profiles.pro_trial_converted_at is 'When the user converted from Pro trial to paid Pro/Enterprise. Null = never converted or not from trial. Set automatically by trigger when subscription_tier changes from free to pro/enterprise and pro_trial_started_at was set.';

-- Trigger: set pro_trial_converted_at when subscription_tier changes from free to pro/enterprise
-- and the user had an active trial (pro_trial_started_at not null).
-- Only sets if NEW.pro_trial_converted_at is null (allows manual override).
create or replace function public.profiles_set_pro_trial_converted_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.subscription_tier = 'free'
     and new.subscription_tier in ('pro', 'enterprise')
     and old.pro_trial_started_at is not null
     and new.pro_trial_converted_at is null
  then
    new.pro_trial_converted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_set_pro_trial_converted_at_trigger on public.profiles;
create trigger profiles_set_pro_trial_converted_at_trigger
  before update on public.profiles
  for each row
  execute function public.profiles_set_pro_trial_converted_at();

comment on function public.profiles_set_pro_trial_converted_at() is 'Sets pro_trial_converted_at when subscription_tier changes from free to pro/enterprise and user had a trial.';

-- Backfill: existing converted users (tier pro/enterprise, had trial, no converted_at yet)
update public.profiles
set pro_trial_converted_at = coalesce(updated_at, pro_trial_expires_at, now())
where subscription_tier in ('pro', 'enterprise')
  and pro_trial_started_at is not null
  and pro_trial_converted_at is null;
