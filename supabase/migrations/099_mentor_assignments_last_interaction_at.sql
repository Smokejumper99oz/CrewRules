-- Ensure legacy or partial DBs have the column referenced by mentoring/actions.ts.
alter table public.mentor_assignments
  add column if not exists last_interaction_at timestamptz;
