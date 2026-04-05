-- One-shot internal ops email marker for pending (unconfirmed) signups.

alter table public.pending_signups
  add column if not exists internal_notify_at timestamptz;

comment on column public.pending_signups.internal_notify_at is
  'When internal ops was notified about this pending signup (e.g. email). Null if not sent.';
