-- Log for mentor assignment emails (Resend send + optional open tracking).
-- Does not alter existing tables.

create table public.mentor_email_events (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.mentor_assignments (id) on delete cascade,
  email text not null,
  event_type text not null,
  resend_email_id text,
  created_at timestamptz not null default now(),
  constraint mentor_email_events_event_type_valid
    check (event_type in ('sent', 'opened'))
);

create index if not exists mentor_email_events_assignment_id_created_at_idx
  on public.mentor_email_events (assignment_id, created_at desc);

create index if not exists mentor_email_events_resend_email_id_idx
  on public.mentor_email_events (resend_email_id)
  where resend_email_id is not null;

comment on table public.mentor_email_events is
  'Mentor assignment email lifecycle: send and optional open events from Resend.';
comment on column public.mentor_email_events.assignment_id is 'public.mentor_assignments.id';
comment on column public.mentor_email_events.email is 'Recipient address for this event.';
comment on column public.mentor_email_events.event_type is 'sent or opened.';
comment on column public.mentor_email_events.resend_email_id is 'Resend message id when available.';
