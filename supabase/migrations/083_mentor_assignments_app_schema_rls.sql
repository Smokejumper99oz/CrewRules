-- Align public.mentor_assignments with application code:
--   app/frontier/pilots/portal/mentoring/actions.ts (mentor_user_id, mentee_user_id, hire_date, active, assigned_at)
--   lib/mentoring/link-mentee-to-assignments.ts (employee_number)
--   lib/mentoring/super-admin-sync-assignment.ts (insert/upsert)
--
-- Migration 059 introduced mentor_id / mentee_id and RLS referencing those names; the app expects
-- mentor_user_id / mentee_user_id and FK names mentor_assignments_*_user_id_fkey for PostgREST embeds.

-- Rename legacy columns when present and app columns are absent
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mentor_assignments' AND column_name = 'mentor_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mentor_assignments' AND column_name = 'mentor_user_id'
  ) THEN
    ALTER TABLE public.mentor_assignments RENAME COLUMN mentor_id TO mentor_user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mentor_assignments' AND column_name = 'mentee_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mentor_assignments' AND column_name = 'mentee_user_id'
  ) THEN
    ALTER TABLE public.mentor_assignments RENAME COLUMN mentee_id TO mentee_user_id;
  END IF;
END $$;

-- Pending mentee links (employee_number match before mentee_user_id is set)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mentor_assignments' AND column_name = 'mentee_user_id'
  ) THEN
    ALTER TABLE public.mentor_assignments ALTER COLUMN mentee_user_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE public.mentor_assignments
  ADD COLUMN IF NOT EXISTS employee_number text,
  ADD COLUMN IF NOT EXISTS hire_date date,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz NOT NULL DEFAULT now();

-- PostgREST embed hints use these constraint names (see mentoring/actions.ts)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'mentor_assignments' AND c.conname = 'mentor_assignments_mentor_id_fkey'
  ) THEN
    ALTER TABLE public.mentor_assignments RENAME CONSTRAINT mentor_assignments_mentor_id_fkey TO mentor_assignments_mentor_user_id_fkey;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'mentor_assignments' AND c.conname = 'mentor_assignments_mentee_id_fkey'
  ) THEN
    ALTER TABLE public.mentor_assignments RENAME CONSTRAINT mentor_assignments_mentee_id_fkey TO mentor_assignments_mentee_user_id_fkey;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Replace RLS policies to use mentor_user_id (required for selects to return rows for the app user)
DROP POLICY IF EXISTS "Users can read own mentor_assignments" ON public.mentor_assignments;
CREATE POLICY "Users can read own mentor_assignments"
  ON public.mentor_assignments FOR SELECT
  USING (
    auth.uid() = mentor_user_id OR auth.uid() = mentee_user_id
  );

DROP POLICY IF EXISTS "Admins can insert mentor_assignments" ON public.mentor_assignments;
CREATE POLICY "Admins can insert mentor_assignments"
  ON public.mentor_assignments FOR INSERT
  WITH CHECK (
    is_profile_admin((SELECT tenant FROM public.profiles WHERE id = mentor_user_id))
  );

DROP POLICY IF EXISTS "Admins can update mentor_assignments" ON public.mentor_assignments;
CREATE POLICY "Admins can update mentor_assignments"
  ON public.mentor_assignments FOR UPDATE
  USING (
    is_profile_admin((SELECT tenant FROM public.profiles WHERE id = mentor_user_id))
  )
  WITH CHECK (
    is_profile_admin((SELECT tenant FROM public.profiles WHERE id = mentor_user_id))
  );

DROP POLICY IF EXISTS "Admins can delete mentor_assignments" ON public.mentor_assignments;
CREATE POLICY "Admins can delete mentor_assignments"
  ON public.mentor_assignments FOR DELETE
  USING (
    is_profile_admin((SELECT tenant FROM public.profiles WHERE id = mentor_user_id))
  );

-- Allow mentees to set mentee_user_id when the row was created with their employee_number (link-mentee-to-assignments.ts)
DROP POLICY IF EXISTS "Mentee can link assignment by employee_number" ON public.mentor_assignments;
CREATE POLICY "Mentee can link assignment by employee_number"
  ON public.mentor_assignments FOR UPDATE
  USING (
    mentee_user_id IS NULL
    AND employee_number IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND btrim(COALESCE(p.employee_number, '')) = btrim(mentor_assignments.employee_number)
    )
  )
  WITH CHECK (mentee_user_id = auth.uid());
