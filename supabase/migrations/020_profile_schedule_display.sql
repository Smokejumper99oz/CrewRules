-- Schedule display: add 'both' mode and timezone label toggle

-- Drop existing check and add new one with 'both'
alter table public.profiles drop constraint if exists profiles_display_timezone_mode_check;
alter table public.profiles add constraint profiles_display_timezone_mode_check
  check (display_timezone_mode in ('base', 'device', 'toggle', 'both'));

alter table public.profiles
  add column if not exists show_timezone_label boolean not null default false;

comment on column public.profiles.show_timezone_label is 'When true, show timezone label next to times (e.g. 2230 SJU).';
