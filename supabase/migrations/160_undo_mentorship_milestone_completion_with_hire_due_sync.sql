-- Atomic mentor-only undo of milestone completion + hire-baseline due_date resync (single transaction).
-- Mirrors skip rules in lib/mentoring/create-milestones-for-assignment.ts syncMentorshipMilestoneDueDatesFromHireForAssignment.
-- Downstream due_date writes are clamped vs immediate predecessor (chronology Rule 4 incomplete pred; Rule 3 completed pred).

create or replace function public.undo_mentorship_milestone_completion_with_hire_due_sync(
  p_assignment_id uuid,
  p_milestone_type text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  prog constant text[] := array[
    'initial_assignment',
    'type_rating',
    'oe_complete',
    'three_months',
    'six_months',
    'nine_months',
    'probation_checkride'
  ];
  v_target_idx int;
  v_hire date;
  v_updated int;
  v_tr_complete boolean;
  v_oe_complete boolean;
  v_i int;
  v_mt text;
  v_row_id uuid;
  v_cur_due date;
  v_new_due date;
  v_eff_due date;
  v_pred_due date;
  v_pred_completed date;
  v_d_initial date;
  v_d_type_rating date;
  v_d_oe date;
  v_d_three date;
  v_d_six date;
  v_d_nine date;
  v_d_probation date;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if not exists (
    select 1
    from public.mentor_assignments ma
    where ma.id = p_assignment_id
      and ma.mentor_user_id = auth.uid()
  ) then
    raise exception 'Only the assigned mentor can undo milestone completion.';
  end if;

  select ma.hire_date::date
    into v_hire
  from public.mentor_assignments ma
  where ma.id = p_assignment_id;

  if v_hire is null then
    raise exception 'Assignment has no hire date.';
  end if;

  v_target_idx := array_position(prog, p_milestone_type);
  if v_target_idx is null then
    raise exception 'Milestone not found.';
  end if;

  if exists (
    select 1
    from public.mentorship_milestones mm
    where mm.assignment_id = p_assignment_id
      and mm.completed_date is not null
      and array_position(prog, mm.milestone_type) is not null
      and array_position(prog, mm.milestone_type) > v_target_idx
  ) then
    raise exception
      'This milestone can''t be undone because a later milestone has already been completed. Please contact Admin.';
  end if;

  if not exists (
    select 1
    from public.mentorship_milestones mm
    where mm.assignment_id = p_assignment_id
      and mm.milestone_type = p_milestone_type
      and mm.completed_date is not null
  ) then
    raise exception 'Milestone is not completed yet.';
  end if;

  update public.mentorship_milestones mm
  set
    completed_date = null,
    completed_at = null,
    completion_note = null
  where mm.assignment_id = p_assignment_id
    and mm.milestone_type = p_milestone_type;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Milestone could not be updated.';
  end if;

  -- Hire baseline (same intervals as getMilestoneScheduleForHireDate in create-milestones-for-assignment.ts)
  v_d_initial := v_hire;
  v_d_type_rating := (v_hire + interval '42 days')::date;
  v_d_oe := (v_hire + interval '42 days' + interval '14 days')::date;
  v_d_three := (v_d_oe + interval '3 months')::date;
  v_d_six := (v_d_three + interval '3 months')::date;
  v_d_nine := (v_d_six + interval '3 months')::date;
  v_d_probation := (v_hire + interval '365 days')::date;

  select exists (
    select 1
    from public.mentorship_milestones m2
    where m2.assignment_id = p_assignment_id
      and m2.milestone_type = 'type_rating'
      and m2.completed_date is not null
  ) into v_tr_complete;

  select exists (
    select 1
    from public.mentorship_milestones m2
    where m2.assignment_id = p_assignment_id
      and m2.milestone_type = 'oe_complete'
      and m2.completed_date is not null
  ) into v_oe_complete;

  for v_i in 1 .. array_length(prog, 1) loop
    v_mt := prog[v_i];

    select mm.id, mm.due_date
      into v_row_id, v_cur_due
    from public.mentorship_milestones mm
    where mm.assignment_id = p_assignment_id
      and mm.milestone_type = v_mt;

    if not found then
      continue;
    end if;

    v_new_due := case v_mt
      when 'initial_assignment' then v_d_initial
      when 'type_rating' then v_d_type_rating
      when 'oe_complete' then v_d_oe
      when 'three_months' then v_d_three
      when 'six_months' then v_d_six
      when 'nine_months' then v_d_nine
      when 'probation_checkride' then v_d_probation
      else null
    end;

    if v_new_due is null then
      continue;
    end if;

    if v_mt = 'oe_complete' and v_tr_complete then
      continue;
    end if;

    if (v_mt = 'three_months' or v_mt = 'six_months') and v_oe_complete then
      continue;
    end if;

    -- Predecessor-aware clamp: Rule 4 (incomplete pred + pred.due); Rule 3 (completed pred + pred.completed_date)
    v_eff_due := v_new_due;
    if v_i > 1 then
      select mm2.due_date, mm2.completed_date
        into v_pred_due, v_pred_completed
      from public.mentorship_milestones mm2
      where mm2.assignment_id = p_assignment_id
        and mm2.milestone_type = prog[v_i - 1];

      if found then
        if v_pred_completed is null and v_pred_due is not null then
          v_eff_due := greatest(v_eff_due, v_pred_due);
        end if;
        if v_pred_completed is not null then
          v_eff_due := greatest(v_eff_due, v_pred_completed);
        end if;
      end if;
    end if;

    if v_cur_due is distinct from v_eff_due then
      update public.mentorship_milestones mm
      set due_date = v_eff_due
      where mm.id = v_row_id;
    end if;
  end loop;
end;
$fn$;

comment on function public.undo_mentorship_milestone_completion_with_hire_due_sync(uuid, text) is
  'Mentor-only: tail-only undo clears completion fields and reapplies hire-baseline due dates with the same skip rules as syncMentorshipMilestoneDueDatesFromHireForAssignment; single transaction.';

revoke all on function public.undo_mentorship_milestone_completion_with_hire_due_sync(uuid, text) from public;
grant execute on function public.undo_mentorship_milestone_completion_with_hire_due_sync(uuid, text) to authenticated;
