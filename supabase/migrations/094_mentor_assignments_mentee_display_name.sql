-- Display name from mentoring CSV for mentor UI when profile full_name is missing.

alter table public.mentor_assignments
  add column if not exists mentee_display_name text null;

comment on column public.mentor_assignments.mentee_display_name is 'Mentee name from import (e.g. CSV); fallback when profiles.full_name is empty.';
