-- Mentoring CSV import: persist optional assignment notes and optional mentee personal email.

alter table public.mentor_assignments
  add column if not exists notes text;

comment on column public.mentor_assignments.notes is 'Optional admin/ops notes from mentoring CSV import.';

alter table public.profiles
  add column if not exists personal_email text;

comment on column public.profiles.personal_email is 'Optional non-company email for the profile (e.g. CSV mentee_email@private).';
