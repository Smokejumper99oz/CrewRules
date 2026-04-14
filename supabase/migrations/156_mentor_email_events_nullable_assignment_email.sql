-- Allow Resend webhook "opened" rows before assignment_id is resolved.
alter table public.mentor_email_events
  alter column assignment_id drop not null;

alter table public.mentor_email_events
  alter column email drop not null;

comment on column public.mentor_email_events.assignment_id is
  'public.mentor_assignments.id; null when not yet resolved (e.g. webhook-only open).';
