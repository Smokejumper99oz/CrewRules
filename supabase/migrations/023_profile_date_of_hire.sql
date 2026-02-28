-- Date of hire for payment calculation and anniversary notes
alter table public.profiles
  add column if not exists date_of_hire date;

comment on column public.profiles.date_of_hire is 'Date of hire (DOH) for payment calculation and anniversary notes.';
