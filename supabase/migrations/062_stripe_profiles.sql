-- Stripe billing fields for profiles. Used for webhook-based subscription sync.

alter table public.profiles
  add column if not exists stripe_customer_id text null,
  add column if not exists stripe_subscription_id text null,
  add column if not exists stripe_price_id text null,
  add column if not exists subscription_status text null,
  add column if not exists current_period_end timestamptz null,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists billing_interval text null,
  add column if not exists billing_source text null;

comment on column public.profiles.stripe_customer_id is 'Stripe customer id (e.g. cus_xxx).';
comment on column public.profiles.stripe_subscription_id is 'Stripe subscription id (e.g. sub_xxx).';
comment on column public.profiles.stripe_price_id is 'Stripe price id (e.g. price_xxx).';
comment on column public.profiles.subscription_status is 'Stripe subscription status: active, trialing, past_due, canceled, incomplete, etc.';
comment on column public.profiles.current_period_end is 'End of active billing period.';
comment on column public.profiles.cancel_at_period_end is 'Whether subscription will end at period close.';
comment on column public.profiles.billing_interval is 'Billing interval: monthly | annual.';
comment on column public.profiles.billing_source is 'Billing source: stripe | trial | enterprise | manual.';

create index if not exists profiles_stripe_customer_id_idx on public.profiles (stripe_customer_id) where stripe_customer_id is not null;
create index if not exists profiles_stripe_subscription_id_idx on public.profiles (stripe_subscription_id) where stripe_subscription_id is not null;
create index if not exists profiles_subscription_status_idx on public.profiles (subscription_status) where subscription_status is not null;
