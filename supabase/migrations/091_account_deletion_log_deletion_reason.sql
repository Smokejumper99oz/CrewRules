-- Snapshot of profiles.deletion_reason at finalize start (profile row is removed after success).

alter table public.account_deletion_log
  add column if not exists deletion_reason text null;

comment on column public.account_deletion_log.deletion_reason is
  'Copy of profiles.deletion_reason when finalize began; retained after auth user is deleted.';
