-- Allow feedback from the public marketing site (no auth user).

alter table public.feedback_submissions
  alter column submitter_user_id drop not null;

comment on column public.feedback_submissions.submitter_user_id is
  'Auth user when signed in; null for public-site feedback.';
