-- Pro trial reminder email tracking: prevents duplicate 7-day and 3-day reminder emails.

alter table public.profiles
  add column if not exists pro_trial_reminder_7d_sent_at timestamptz null,
  add column if not exists pro_trial_reminder_3d_sent_at timestamptz null;

comment on column public.profiles.pro_trial_reminder_7d_sent_at is 'When the 7-day Pro trial reminder email was sent. Null = not yet sent. Used to prevent duplicate sends.';
comment on column public.profiles.pro_trial_reminder_3d_sent_at is 'When the 3-day Pro trial reminder email was sent. Null = not yet sent. Used to prevent duplicate sends.';
