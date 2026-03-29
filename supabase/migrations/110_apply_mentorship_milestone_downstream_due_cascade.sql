-- Re-apply the same downstream due_date shifts as complete_mentorship_milestone_with_cascade (109)
-- when a completion date is edited after the milestone was already completed (portal mentoring).

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

comment on function public.apply_mentorship_milestone_downstream_due_cascade(uuid, text, date) is
  'Same due_date cascade as complete_mentorship_milestone_with_cascade after type_rating or oe_complete completion (type_rating→oe_complete +14d; oe_complete→three_months +3mo, six_months +6mo). For edit flows after the milestone is already complete.';

revoke all on function public.apply_mentorship_milestone_downstream_due_cascade(uuid, text, date) from public;
grant execute on function public.apply_mentorship_milestone_downstream_due_cascade(uuid, text, date) to authenticated;
