-- Profile time settings for schedule display and ICS import
-- baseTimezone: IANA string (e.g. America/Puerto_Rico) - user's base/home timezone
-- displayTimezoneMode: base | device | toggle - which timezone to show
-- timeFormat: 24h | 12h

alter table public.profiles
  add column if not exists base_timezone text not null default 'America/Denver',
  add column if not exists display_timezone_mode text not null default 'base'
    check (display_timezone_mode in ('base', 'device', 'toggle')),
  add column if not exists time_format text not null default '24h'
    check (time_format in ('24h', '12h'));

comment on column public.profiles.base_timezone is 'IANA timezone (e.g. America/Puerto_Rico) for schedule display and ICS import source.';
comment on column public.profiles.display_timezone_mode is 'Display mode: base (always base tz), device (browser local), toggle (user can switch).';
comment on column public.profiles.time_format is '24h or 12h.';
