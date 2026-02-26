-- All-in-one: create document_chunks + match_document_chunks (run this if 005/006/008 had issues)
-- Run in Supabase SQL Editor. Requires: vector extension, profiles table.

create extension if not exists vector;

create table if not exists public.document_chunks (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  "embedding" vector(1536),
  source_path text,
  source_category text,
  tenant text not null default 'frontier',
  "portal" text not null default 'pilots',
  created_at timestamptz default now()
);

alter table public.document_chunks enable row level security;

drop policy if exists "Authenticated users can read document_chunks" on public.document_chunks;
create policy "Authenticated users can read document_chunks"
  on public.document_chunks for select
  using (auth.role() = 'authenticated');

drop policy if exists "Admins can manage document_chunks" on public.document_chunks;
create policy "Admins can manage document_chunks"
  on public.document_chunks for all
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

create or replace function match_document_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 5,
  p_tenant text default 'frontier',
  p_portal text default 'pilots'
)
returns table (
  id uuid,
  "content" text,
  "source_path" text,
  "source_category" text,
  "similarity" float
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    dc.id,
    dc.content,
    dc.source_path,
    dc.source_category,
    (1 - (dc."embedding" <=> query_embedding))::float as "similarity"
  from public.document_chunks dc
  where dc.tenant = p_tenant
    and dc."portal" = p_portal
    and (1 - (dc."embedding" <=> query_embedding)) > match_threshold
  order by dc."embedding" <=> query_embedding
  limit match_count;
end;
$$;
