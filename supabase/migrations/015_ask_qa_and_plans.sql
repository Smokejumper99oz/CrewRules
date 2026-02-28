-- Plans: free, pro, enterprise. Pro/Enterprise get permanent Q&A storage.
-- Run in Supabase SQL Editor after 013

alter table public.profiles
  add column if not exists plan text not null default 'free'
  check (plan in ('free', 'pro', 'enterprise'));

comment on column public.profiles.plan is 'Subscription plan: free, pro, enterprise. Pro/Enterprise store Q&A permanently.';

-- To enable Q&A storage for testing: update profiles set plan = 'pro' where email = 'your@email.com';

-- Update handle_new_user to set plan (default free)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, tenant, portal, role, crew_role, plan)
  values (new.id, new.email, 'frontier', 'pilots', 'member', 'pilot', 'free');
  return new;
end;
$$;

-- Ask Q&A table: stores question/answer with citation for Pro/Enterprise
create table if not exists public.ask_qa (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant text not null default 'frontier',
  portal text not null default 'pilots',
  question text not null,
  answer text,
  citation text,
  citation_path text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ask_qa_user_archived_created
  on public.ask_qa (user_id, archived, created_at desc);

alter table public.ask_qa enable row level security;

-- Users can read their own rows
create policy "Users can read own ask_qa"
  on public.ask_qa for select
  using (auth.uid() = user_id);

-- Users can insert their own rows (Pro/Enterprise enforced in app)
create policy "Users can insert own ask_qa"
  on public.ask_qa for insert
  with check (auth.uid() = user_id);

-- Users can update their own rows (e.g. archived flag)
create policy "Users can update own ask_qa"
  on public.ask_qa for update
  using (auth.uid() = user_id);
