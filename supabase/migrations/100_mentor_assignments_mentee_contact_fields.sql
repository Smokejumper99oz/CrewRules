-- CSV/import snapshot: mentee private email and phone for mentor UI when profile is unlinked or fields empty.
alter table public.mentor_assignments
  add column if not exists mentee_personal_email text,
  add column if not exists mentee_phone text;

comment on column public.mentor_assignments.mentee_personal_email is
  'Optional mentee private email from import; fallback until profiles.personal_email is set.';
comment on column public.mentor_assignments.mentee_phone is
  'Optional mentee phone from import; fallback until profiles.phone is set.';
