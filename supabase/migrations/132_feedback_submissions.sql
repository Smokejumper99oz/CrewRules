-- In-app feedback submissions (inserts via service role; Super Admin read via RLS).

create table public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  feedback_type text not null check (feedback_type in ('bug', 'feature', 'feedback')),
  message text not null,
  submitter_user_id uuid not null references auth.users (id),
  profile_id uuid references public.profiles (id),
  submitter_email text,
  submitter_full_name text,
  tenant text not null,
  portal text not null,
  route_path text,
  client_context jsonb
);

create index idx_feedback_submissions_tenant_created_at
  on public.feedback_submissions (tenant, created_at desc);

create index idx_feedback_submissions_feedback_type_created_at
  on public.feedback_submissions (feedback_type, created_at desc);

alter table public.feedback_submissions enable row level security;

create policy "Super admin can read feedback_submissions"
  on public.feedback_submissions for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'super_admin'
    )
  );

comment on table public.feedback_submissions is 'User-submitted feedback; written by app (service role); read by Super Admin only.';
