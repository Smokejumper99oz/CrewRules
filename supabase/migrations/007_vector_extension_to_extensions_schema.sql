-- Move vector extension from public to extensions schema (fixes Supabase linter 0014)
-- Run in Supabase SQL Editor after 005 and 006

create schema if not exists extensions;

-- Move existing vector extension to extensions schema
alter extension vector set schema extensions;
