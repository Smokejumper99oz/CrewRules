-- Super Admin triage: workflow status on feedback_submissions.

alter table public.feedback_submissions
  add column status text not null default 'new'
    constraint feedback_submissions_status_check
    check (status in ('new', 'in_progress', 'closed'));

alter table public.feedback_submissions
  add column status_updated_at timestamptz;

comment on column public.feedback_submissions.status is 'Super Admin triage: new | in_progress | closed.';
comment on column public.feedback_submissions.status_updated_at is 'Set when Super Admin changes status.';
