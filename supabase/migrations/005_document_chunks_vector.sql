-- Enable pgvector extension for semantic search
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New query

create extension if not exists vector;

-- Document chunks: text segments from uploaded docs with embeddings
create table if not exists document_chunks (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  "embedding" vector(1536),
  source_path text,
  source_category text,
  tenant text not null default 'frontier',
  "portal" text not null default 'pilots',
  created_at timestamptz default now()
);

alter table document_chunks enable row level security;

-- Authenticated users can read chunks (for search)
drop policy if exists "Authenticated users can read document_chunks" on document_chunks;
create policy "Authenticated users can read document_chunks"
  on document_chunks for select
  using (auth.role() = 'authenticated');

-- Only admins can insert/update/delete (for indexing - use service role or check profiles)
drop policy if exists "Admins can manage document_chunks" on document_chunks;
create policy "Admins can manage document_chunks"
  on document_chunks for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Index for fast cosine similarity search (create after table has rows)
-- create index document_chunks_embedding_idx on document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- RPC for similarity search
create or replace function match_document_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 5
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
    document_chunks.id,
    document_chunks.content,
    document_chunks.source_path,
    document_chunks.source_category,
    1 - (document_chunks."embedding" <=> query_embedding) as "similarity"
  from document_chunks
  where 1 - (document_chunks."embedding" <=> query_embedding) > match_threshold
  order by document_chunks."embedding" <=> query_embedding
  limit match_count;
end;
$$;
