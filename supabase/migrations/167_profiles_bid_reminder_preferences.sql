-- Bid & trading reminder preferences on pilot dashboard (snooze / per-month suppress).

alter table public.profiles
  add column if not exists bid_reminder_snoozed_until timestamptz null,
  add column if not exists bid_reminder_suppressed_month text null;

comment on column public.profiles.bid_reminder_snoozed_until is
  'When set, bid/trading reminder UI is hidden until this instant (UTC).';

comment on column public.profiles.bid_reminder_suppressed_month is
  'Calendar month for which the user chose not to see bid/trading reminders; format YYYY-MM.';
