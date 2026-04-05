-- Optional reply-to address for public (logged-out) feedback only.

alter table public.feedback_submissions
  add column contact_email text;

comment on column public.feedback_submissions.contact_email is
  'Optional email for a reply; used for anonymous/public submissions when the visitor provides it.';
