-- Fix RLS: mentor_assignments has RLS enabled but no policies (linter 0008).
-- Mentors/mentees are assigned by Union/Admin. Users can read their own assignments.
-- Tenant derived from profiles.

create table if not exists public.mentor_assignments (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  mentee_id uuid not null references public.profiles(id) on delete cascade,
  next_milestone_label text,
  next_milestone_due_date date,
  last_interaction_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (mentor_id, mentee_id)
);

alter table public.mentor_assignments enable row level security;

drop policy if exists "Users can read own mentor_assignments" on public.mentor_assignments;
create policy "Users can read own mentor_assignments"
  on public.mentor_assignments for select
  using (
    auth.uid() = mentor_id or auth.uid() = mentee_id
  );

drop policy if exists "Admins can insert mentor_assignments" on public.mentor_assignments;
create policy "Admins can insert mentor_assignments"
  on public.mentor_assignments for insert
  with check (
    is_profile_admin((select tenant from public.profiles where id = mentor_id))
  );

drop policy if exists "Admins can update mentor_assignments" on public.mentor_assignments;
create policy "Admins can update mentor_assignments"
  on public.mentor_assignments for update
  using (
    is_profile_admin((select tenant from public.profiles where id = mentor_id))
  )
  with check (
    is_profile_admin((select tenant from public.profiles where id = mentor_id))
  );

drop policy if exists "Admins can delete mentor_assignments" on public.mentor_assignments;
create policy "Admins can delete mentor_assignments"
  on public.mentor_assignments for delete
  using (
    is_profile_admin((select tenant from public.profiles where id = mentor_id))
  );
