-- Fix: qualify document_chunks with public schema (search_path = '' hides it otherwise)
-- Run in Supabase SQL Editor.
-- If you still get "relation does not exist", run 005 first to create the table.

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
    1 - (dc."embedding" <=> query_embedding)::float as "similarity"
  from public.document_chunks dc
  where dc.tenant = p_tenant
    and dc."portal" = p_portal
    and 1 - (dc."embedding" <=> query_embedding) > match_threshold
  order by dc."embedding" <=> query_embedding
  limit match_count;
end;
$$;
