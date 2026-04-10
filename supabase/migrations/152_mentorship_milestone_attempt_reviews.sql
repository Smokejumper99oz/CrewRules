-- Admin workflow for failed milestone attempts (open / resolved / archived).
-- Additive only; does not alter mentorship_milestone_attempts.
-- Service role bypasses RLS for server-side jobs.

create table if not exists public.mentorship_milestone_attempt_reviews (
  attempt_id uuid primary key references public.mentorship_milestone_attempts (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'resolved', 'archived')),
  resolved_at timestamptz,
  resolved_note text,
  archived_at timestamptz,
  archived_reason text,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.mentorship_milestone_attempt_reviews is
  'Admin workflow state for failed milestone attempts; raw events remain in mentorship_milestone_attempts.';
comment on column public.mentorship_milestone_attempt_reviews.attempt_id is
  'One review row per failed attempt; cascades when the attempt row is removed.';
comment on column public.mentorship_milestone_attempt_reviews.status is
  'open = needs admin attention; resolved = addressed; archived = closed without pass.';
comment on column public.mentorship_milestone_attempt_reviews.resolved_by is
  'Optional profiles.id of the admin who resolved (tenant_admin or super_admin).';

alter table public.mentorship_milestone_attempt_reviews enable row level security;

-- Read: tenant admins for the assignment mentor tenant, or super_admin (via is_profile_admin).
create policy "Tenant admins can select mentorship_milestone_attempt_reviews"
  on public.mentorship_milestone_attempt_reviews
  for select
  using (
    exists (
      select 1
      from public.mentorship_milestone_attempts a
      inner join public.mentor_assignments ma on ma.id = a.assignment_id
      where a.id = mentorship_milestone_attempt_reviews.attempt_id
        and public.is_profile_admin(
          (select p.tenant from public.profiles p where p.id = ma.mentor_user_id)
        )
    )
  );

-- Insert/update/delete: admins only (no mentor/mentee policies on this table).
create policy "Tenant admins can insert mentorship_milestone_attempt_reviews"
  on public.mentorship_milestone_attempt_reviews
  for insert
  with check (
    exists (
      select 1
      from public.mentorship_milestone_attempts a
      inner join public.mentor_assignments ma on ma.id = a.assignment_id
      where a.id = mentorship_milestone_attempt_reviews.attempt_id
        and public.is_profile_admin(
          (select p.tenant from public.profiles p where p.id = ma.mentor_user_id)
        )
    )
  );

create policy "Tenant admins can update mentorship_milestone_attempt_reviews"
  on public.mentorship_milestone_attempt_reviews
  for update
  using (
    exists (
      select 1
      from public.mentorship_milestone_attempts a
      inner join public.mentor_assignments ma on ma.id = a.assignment_id
      where a.id = mentorship_milestone_attempt_reviews.attempt_id
        and public.is_profile_admin(
          (select p.tenant from public.profiles p where p.id = ma.mentor_user_id)
        )
    )
  )
  with check (
    exists (
      select 1
      from public.mentorship_milestone_attempts a
      inner join public.mentor_assignments ma on ma.id = a.assignment_id
      where a.id = mentorship_milestone_attempt_reviews.attempt_id
        and public.is_profile_admin(
          (select p.tenant from public.profiles p where p.id = ma.mentor_user_id)
        )
    )
  );

create policy "Tenant admins can delete mentorship_milestone_attempt_reviews"
  on public.mentorship_milestone_attempt_reviews
  for delete
  using (
    exists (
      select 1
      from public.mentorship_milestone_attempts a
      inner join public.mentor_assignments ma on ma.id = a.assignment_id
      where a.id = mentorship_milestone_attempt_reviews.attempt_id
        and public.is_profile_admin(
          (select p.tenant from public.profiles p where p.id = ma.mentor_user_id)
        )
    )
  );
