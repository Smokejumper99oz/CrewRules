-- Fail fast when type_rating cascade cannot update oe_complete (0 rows), instead of silent no-op.

create or replace function public.apply_mentorship_milestone_downstream_due_cascade(
  p_assignment_id uuid,
  p_completed_milestone_type text,
  p_completed_date date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_cascade int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if not exists (
    select 1
    from public.mentor_assignments ma
    where ma.id = p_assignment_id
      and (ma.mentor_user_id = auth.uid() or ma.mentee_user_id = auth.uid())
  ) then
    raise exception 'Assignment not found.';
  end if;

  if p_completed_milestone_type = 'type_rating' then
    update public.mentorship_milestones mm
    set due_date = p_completed_date + interval '14 days'
    where mm.assignment_id = p_assignment_id
      and mm.milestone_type = 'oe_complete';
    get diagnostics v_cascade = row_count;
    if v_cascade = 0 then
      raise exception 'Mentoring cascade: missing oe_complete row (admin: Generate missing milestones).';
    end if;
  elsif p_completed_milestone_type = 'oe_complete' then
    update public.mentorship_milestones mm
    set due_date = p_completed_date + interval '3 months'
    where mm.assignment_id = p_assignment_id
      and mm.milestone_type = 'three_months';

    update public.mentorship_milestones mm
    set due_date = p_completed_date + interval '6 months'
    where mm.assignment_id = p_assignment_id
      and mm.milestone_type = 'six_months';
  end if;
end;
$fn$;

create or replace function public.complete_mentorship_milestone_with_cascade(
  p_assignment_id uuid,
  p_milestone_type text,
  p_completed_date date,
  p_completion_note text,
  p_completed_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_prev_completed date;
  v_updated int;
  v_cascade int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if not exists (
    select 1
    from public.mentor_assignments ma
    where ma.id = p_assignment_id
      and (ma.mentor_user_id = auth.uid() or ma.mentee_user_id = auth.uid())
  ) then
    raise exception 'Assignment not found.';
  end if;

  select mm.completed_date
    into v_prev_completed
  from public.mentorship_milestones mm
  where mm.assignment_id = p_assignment_id
    and mm.milestone_type = p_milestone_type;

  if not found then
    raise exception 'Milestone not found.';
  end if;

  if v_prev_completed is not null then
    return;
  end if;

  update public.mentorship_milestones mm
  set
    completed_date = p_completed_date,
    completion_note = p_completion_note,
    completed_at = p_completed_at
  where mm.assignment_id = p_assignment_id
    and mm.milestone_type = p_milestone_type
    and mm.completed_date is null;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Milestone could not be updated.';
  end if;

  if p_milestone_type = 'type_rating' then
    update public.mentorship_milestones mm
    set due_date = p_completed_date + interval '14 days'
    where mm.assignment_id = p_assignment_id
      and mm.milestone_type = 'oe_complete';
    get diagnostics v_cascade = row_count;
    if v_cascade = 0 then
      raise exception 'Mentoring cascade: missing oe_complete row (admin: Generate missing milestones).';
    end if;
  elsif p_milestone_type = 'oe_complete' then
    update public.mentorship_milestones mm
    set due_date = p_completed_date + interval '3 months'
    where mm.assignment_id = p_assignment_id
      and mm.milestone_type = 'three_months';

    update public.mentorship_milestones mm
    set due_date = p_completed_date + interval '6 months'
    where mm.assignment_id = p_assignment_id
      and mm.milestone_type = 'six_months';
  end if;
end;
$fn$;
