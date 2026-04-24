-- Dedupe commute conflict alert emails: one send per trip key (see lib/cron/run-commute-conflict-alerts.ts).

alter table public.profiles
  add column if not exists last_commute_alert_trip_id text null;

comment on column public.profiles.last_commute_alert_trip_id is
  'Last trip key for which a commute conflict alert email was sent (user_id + "_" + schedule event start_time). Null = none sent yet.';
