-- Family View Sharing settings (visibility toggles for shared schedule)
alter table public.profiles
  add column if not exists family_view_enabled boolean not null default false,
  add column if not exists family_view_show_exact_times boolean not null default true,
  add column if not exists family_view_show_overnight_cities boolean not null default true,
  add column if not exists family_view_show_commute_estimates boolean not null default true;

comment on column public.profiles.family_view_enabled is 'When true, crew can share Family View with invited viewers.';
comment on column public.profiles.family_view_show_exact_times is 'Show report/home times to Family View viewers.';
comment on column public.profiles.family_view_show_overnight_cities is 'Show overnight city names to Family View viewers.';
comment on column public.profiles.family_view_show_commute_estimates is 'Show commute inference (e.g. Likely commuting) to Family View viewers.';
