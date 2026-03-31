-- Subscription payment facts from Stripe (e.g. invoice.paid). Populated by webhooks in a later step.

create table if not exists public.stripe_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  stripe_invoice_id text not null,
  stripe_charge_id text,
  stripe_balance_transaction_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  profile_id uuid,
  amount_gross_cents bigint,
  fee_cents bigint,
  net_cents bigint,
  currency text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint stripe_subscription_payments_stripe_invoice_id_key unique (stripe_invoice_id)
);

create index if not exists stripe_subscription_payments_paid_at_idx
  on public.stripe_subscription_payments (paid_at);

comment on table public.stripe_subscription_payments is 'Successful paid subscription invoices; gross/fee/net from Stripe balance transactions.';
