-- Profile: commute fields and subscription/trial fields (plan column kept as-is)

-- Commute fields
alter table public.profiles
  add column if not exists home_airport text null,
  add column if not exists commute_arrival_buffer_minutes int not null default 180,
  add column if not exists commute_release_buffer_minutes int not null default 90,
  add column if not exists commute_nonstop_only boolean not null default true;

-- Trial / plan fields (plan column retained)
alter table public.profiles
  add column if not exists subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'pro', 'enterprise')),
  add column if not exists pro_trial_started_at timestamptz null,
  add column if not exists pro_trial_expires_at timestamptz null;

comment on column public.profiles.home_airport is 'IATA code for commute-from airport (e.g. MCO).';
comment on column public.profiles.commute_arrival_buffer_minutes is 'Minutes before duty to arrive when commuting.';
comment on column public.profiles.commute_release_buffer_minutes is 'Minutes after duty release for commute buffer.';
comment on column public.profiles.commute_nonstop_only is 'Prefer nonstop commute flights.';
comment on column public.profiles.subscription_tier is 'Subscription tier: free, pro, enterprise.';
comment on column public.profiles.pro_trial_started_at is 'When Pro trial began.';
comment on column public.profiles.pro_trial_expires_at is 'When Pro trial ends.';

-- Verify new columns exist (run after applying):
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'profiles'
--   and column_name in (
--     'home_airport', 'commute_arrival_buffer_minutes', 'commute_release_buffer_minutes',
--     'commute_nonstop_only', 'subscription_tier', 'pro_trial_started_at', 'pro_trial_expires_at'
--   )
-- order by column_name;
