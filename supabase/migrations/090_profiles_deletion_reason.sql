-- User-provided reason when scheduling account deletion (cleared on cancel).

alter table public.profiles
  add column if not exists deletion_reason text null;

comment on column public.profiles.deletion_reason is
  'Optional free-text reason when the user schedules deletion; cleared if they cancel.';
