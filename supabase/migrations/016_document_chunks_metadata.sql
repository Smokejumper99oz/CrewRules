-- Add metadata JSONB for page, section, heading. Citation UI uses metadata.page and metadata.section.
-- Run in Supabase SQL Editor after 005

alter table public.document_chunks
  add column if not exists page_number integer;

alter table public.document_chunks
  add column if not exists metadata jsonb default '{}';

comment on column public.document_chunks.metadata is 'Chunk metadata: {page: number, section?: string, heading?: string} for citations.';

-- Backfill metadata from page_number for existing chunks
update public.document_chunks
set metadata = jsonb_build_object('page', page_number)
where page_number is not null and (metadata is null or metadata = '{}'::jsonb);

-- Drop and recreate: return type changed (added metadata)
drop function if exists match_document_chunks(vector, double precision, integer, text, text);

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
  "page_number" integer,
  "metadata" jsonb,
  "similarity" float
)
language plpgsql
security definer
set search_path = 'public', 'extensions'
as $body$
begin return query select dc.id, dc.content, dc.source_path, dc.source_category, dc.page_number, coalesce(dc.metadata, jsonb_build_object()), (1-(dc."embedding"<=>query_embedding))::float as similarity from public.document_chunks dc where dc.tenant=p_tenant and dc."portal"=p_portal and (1-(dc."embedding"<=>query_embedding))>match_threshold order by dc."embedding"<=>query_embedding limit match_count; end;
$body$;
