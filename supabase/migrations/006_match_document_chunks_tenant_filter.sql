-- Add tenant/portal filtering to match_document_chunks (Frontier-first)
-- Run in Supabase SQL Editor after 005

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
    document_chunks.id,
    document_chunks.content,
    document_chunks.source_path,
    document_chunks.source_category,
    1 - (document_chunks."embedding" <=> query_embedding) as "similarity"
  from document_chunks
  where document_chunks.tenant = p_tenant
    and document_chunks."portal" = p_portal
    and 1 - (document_chunks."embedding" <=> query_embedding) > match_threshold
  order by document_chunks."embedding" <=> query_embedding
  limit match_count;
end;
$$;
