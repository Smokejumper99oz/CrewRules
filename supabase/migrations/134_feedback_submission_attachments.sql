-- Screenshot (and future) attachments for feedback_submissions. Writes via service role; Super Admin read via RLS.

create table public.feedback_submission_attachments (
  id uuid primary key default gen_random_uuid(),
  feedback_submission_id uuid not null references public.feedback_submissions (id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  byte_size integer,
  sort_order smallint,
  created_at timestamptz not null default now()
);

create index idx_feedback_submission_attachments_submission_sort
  on public.feedback_submission_attachments (feedback_submission_id, sort_order);

alter table public.feedback_submission_attachments enable row level security;

create policy "Super admin can read feedback_submission_attachments"
  on public.feedback_submission_attachments for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'super_admin'
    )
  );

comment on table public.feedback_submission_attachments is 'Files linked to feedback_submissions (e.g. screenshots). Written by app (service role); read by Super Admin only.';
