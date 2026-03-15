-- Stripe webhook event log. Used for idempotency and debugging.

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  processed_at timestamptz null,
  payload jsonb null,
  error text null,
  created_at timestamptz not null default now()
);

comment on table public.stripe_webhook_events is 'Stripe webhook events for idempotency and debugging.';
comment on column public.stripe_webhook_events.stripe_event_id is 'Stripe event id (e.g. evt_xxx). Unique for idempotency.';
comment on column public.stripe_webhook_events.event_type is 'Stripe event type (e.g. customer.subscription.created).';
comment on column public.stripe_webhook_events.processed_at is 'When processing completed. Null = not yet processed or failed.';
comment on column public.stripe_webhook_events.payload is 'Optional payload for debugging.';
comment on column public.stripe_webhook_events.error is 'Error message if processing failed.';
comment on column public.stripe_webhook_events.created_at is 'When the event was received.';
