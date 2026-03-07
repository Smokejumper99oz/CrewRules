-- Add optional alternate home airport for Commute Assist
alter table public.profiles
  add column if not exists alternate_home_airport text null;

comment on column public.profiles.alternate_home_airport is 'Optional backup airport for commute (e.g. MCO) when no flights to home_airport.';
