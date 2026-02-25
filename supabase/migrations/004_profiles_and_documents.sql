-- Profiles table: stores user role per tenant+portal
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New query

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  tenant text not null default 'frontier',
  portal text not null default 'pilots',
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

-- Users can read their own profile
create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

-- Only admins can insert/update profiles (for now we allow service role; you can add admin-only later)
create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Storage bucket for documents (CBA, LOAs, etc.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,
  array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv']
)
on conflict (id) do nothing;

-- RLS for storage: authenticated users can read; admins can upload
create policy "Authenticated users can read documents"
  on storage.objects for select
  using (auth.role() = 'authenticated');

create policy "Admins can upload documents"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

create policy "Admins can update documents"
  on storage.objects for update
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

create policy "Admins can delete documents"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, tenant, portal, role)
  values (new.id, new.email, 'frontier', 'pilots', 'member');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for existing users
insert into profiles (id, email, tenant, portal, role)
select id, email, 'frontier', 'pilots', 'member'
from auth.users
where id not in (select id from profiles);

-- To make yourself admin, run in SQL Editor:
-- update profiles set role = 'admin' where email = 'your@email.com';
