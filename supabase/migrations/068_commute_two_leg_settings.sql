-- Add 2-leg commute settings for future SAV→ATL→SJU / SAV→MCO→SJU style commutes.
-- UI/storage only; not yet connected to commute search logic.

alter table public.profiles
  add column if not exists commute_two_leg_enabled boolean not null default false,
  add column if not exists commute_two_leg_stop_1 text null,
  add column if not exists commute_two_leg_stop_2 text null;

comment on column public.profiles.commute_two_leg_enabled is 'When true, include 2-leg commute search (home→stop→base). Not yet wired to search.';
comment on column public.profiles.commute_two_leg_stop_1 is 'Primary connection airport for 2-leg commutes (e.g. ATL). Uses home_airport/alternate_home_airport for leg 1.';
comment on column public.profiles.commute_two_leg_stop_2 is 'Optional second connection airport for 2-leg commutes (e.g. MCO).';
