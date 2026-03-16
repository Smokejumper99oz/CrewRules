-- Founding Pilot identification. Separate from subscription_tier; Pro access unchanged.

alter table public.profiles
  add column if not exists is_founding_pilot boolean not null default false,
  add column if not exists founding_pilot_started_at timestamptz null;

comment on column public.profiles.is_founding_pilot is 'Permanent founder status. Set by Stripe webhook when user subscribes to Founding Pilot price. Never cleared on cancellation. Used for founder badge and 100-seat cap tracking, not for active Pro access.';
comment on column public.profiles.founding_pilot_started_at is 'When user first became a Founding Pilot subscriber. Set once by webhook. Never cleared.';
