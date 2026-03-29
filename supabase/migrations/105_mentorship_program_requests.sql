create table public.mentorship_program_requests (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  portal text not null,
  user_id uuid not null references public.profiles (id),
  request_type text not null check (request_type in ('new_hire_help','mentor_interest','mentor_no_mentees')),
  status text not null default 'open' check (status in ('open','resolved')),
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_mentorship_program_requests_tenant_portal_created
  on public.mentorship_program_requests (tenant, portal, created_at desc);

create index idx_mentorship_program_requests_status
  on public.mentorship_program_requests (status);

alter table public.mentorship_program_requests enable row level security;

create policy "Users insert own mentoring requests"
  on public.mentorship_program_requests
  for insert
  with check (auth.uid() = user_id);

create policy "No user read"
  on public.mentorship_program_requests
  for select
  using (false);
