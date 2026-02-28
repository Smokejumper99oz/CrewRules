-- Personal information for welcome personalization, filtering, and role logic

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists employee_number text,
  add column if not exists position text check (position in ('captain', 'first_officer', 'flight_attendant')),
  add column if not exists base_airport text,
  add column if not exists equipment text;

comment on column public.profiles.full_name is 'Display name for welcome messages and UI.';
comment on column public.profiles.employee_number is 'Company employee ID.';
comment on column public.profiles.position is 'Crew position: captain, first_officer, or flight_attendant.';
comment on column public.profiles.base_airport is 'Home base IATA code (e.g. SJU, DEN).';
comment on column public.profiles.equipment is 'Optional aircraft type(s) for filtering.';
