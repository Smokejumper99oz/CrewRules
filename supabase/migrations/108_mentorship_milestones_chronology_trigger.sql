-- Enforce in-assignment milestone chronology on public.mentorship_milestones (BEFORE INSERT OR UPDATE).
-- Order: initial_assignment → type_rating → oe_complete → three_months → six_months → nine_months → probation_checkride

create or replace function public.mentorship_milestones_enforce_chronology()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  prog text[] := array[
    'initial_assignment',
    'type_rating',
    'oe_complete',
    'three_months',
    'six_months',
    'nine_months',
    'probation_checkride'
  ];
  idx int;
  pred_type text;
  pred_due date;
  pred_completed date;
  found_pred boolean;
begin
  if new.milestone_type = 'initial_assignment' then
    return new;
  end if;

  idx := array_position(prog, new.milestone_type);
  if idx is null then
    raise exception
      'mentorship_milestones chronology: unknown milestone_type % (assignment_id %)',
      new.milestone_type,
      new.assignment_id;
  end if;

  pred_type := prog[idx - 1];

  select mm.due_date, mm.completed_date
    into pred_due, pred_completed
  from public.mentorship_milestones mm
  where mm.assignment_id = new.assignment_id
    and mm.milestone_type = pred_type;

  found_pred := found;

  if not found_pred then
    raise exception
      'mentorship_milestones chronology: milestone % requires predecessor row % for assignment_id %',
      new.milestone_type,
      pred_type,
      new.assignment_id;
  end if;

  if pred_due is null then
    raise exception
      'mentorship_milestones chronology: predecessor % has null due_date for assignment_id %',
      pred_type,
      new.assignment_id;
  end if;

  -- Rule 1: no completion until immediate predecessor is completed
  if new.completed_date is not null and pred_completed is null then
    raise exception
      'mentorship_milestones chronology: cannot set completed_date on % because predecessor % is not completed (assignment_id %)',
      new.milestone_type,
      pred_type,
      new.assignment_id;
  end if;

  -- Rule 2: completion cannot be earlier than predecessor completion
  if new.completed_date is not null
     and pred_completed is not null
     and new.completed_date < pred_completed
  then
    raise exception
      'mentorship_milestones chronology: % completed_date % is before predecessor % completed_date % (assignment_id %)',
      new.milestone_type,
      new.completed_date,
      pred_type,
      pred_completed,
      new.assignment_id;
  end if;

  -- Rule 3: while predecessor is completed, due_date cannot be before that completion
  if pred_completed is not null and new.due_date < pred_completed then
    raise exception
      'mentorship_milestones chronology: % due_date % is before predecessor % completed_date % (assignment_id %)',
      new.milestone_type,
      new.due_date,
      pred_type,
      pred_completed,
      new.assignment_id;
  end if;

  -- Rule 4: while predecessor is not completed, due_date cannot be before predecessor due_date
  if pred_completed is null and new.due_date < pred_due then
    raise exception
      'mentorship_milestones chronology: % due_date % is before predecessor % due_date % (assignment_id %)',
      new.milestone_type,
      new.due_date,
      pred_type,
      pred_due,
      new.assignment_id;
  end if;

  return new;
end;
$fn$;

comment on function public.mentorship_milestones_enforce_chronology() is
  'BEFORE INSERT OR UPDATE: enforces predecessor order, completion order, and due_date vs predecessor completion/due_date within the same assignment_id.';

drop trigger if exists mentorship_milestones_chronology_before_iu on public.mentorship_milestones;

create trigger mentorship_milestones_chronology_before_iu
  before insert or update on public.mentorship_milestones
  for each row
  execute function public.mentorship_milestones_enforce_chronology();
