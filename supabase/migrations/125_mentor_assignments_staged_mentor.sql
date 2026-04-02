-- Step 1: staged/pending mentor support on mentor_assignments (schema only).
-- mentor_employee_number holds the mentor org id until mentor_user_id is set (future app/RLS work).

alter table public.mentor_assignments
  add column if not exists mentor_employee_number text;

comment on column public.mentor_assignments.mentor_employee_number is
  'Mentor company employee number for staged/pending mentors until a live profiles row exists and mentor_user_id is linked.';

-- Copy mentor employee id from linked profile for existing assignments.
update public.mentor_assignments ma
set mentor_employee_number = nullif(btrim(p.employee_number), '')
from public.profiles p
where ma.mentor_user_id is not null
  and p.id = ma.mentor_user_id;

-- Allow rows where the mentor has not signed up yet (mentor_user_id set later).
alter table public.mentor_assignments
  alter column mentor_user_id drop not null;
