-- Atomic completion + downstream due_date cascade for portal mentoring (single transaction).
-- SECURITY INVOKER: runs as caller; RLS on mentorship_milestones / mentor_assignments applies.

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

comment on function public.complete_mentorship_milestone_with_cascade(uuid, text, date, text, timestamptz) is
  'Marks a milestone complete and applies due_date cascade (type_rating→oe_complete +14d; oe_complete→three_months +3mo, six_months +6mo) in one transaction; idempotent if already completed.';

revoke all on function public.complete_mentorship_milestone_with_cascade(uuid, text, date, text, timestamptz) from public;
grant execute on function public.complete_mentorship_milestone_with_cascade(uuid, text, date, text, timestamptz) to authenticated;
