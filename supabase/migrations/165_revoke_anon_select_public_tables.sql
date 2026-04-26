-- Supabase linter 0026_pg_graphql_anon_table_exposed:
-- With pg_graphql installed, /graphql/v1 introspection exposes schemas for any public table
-- the `anon` role can SELECT — even when RLS returns no rows.
--
-- Unauthenticated Supabase clients use role `anon`. Removing table SELECT stops that leakage.
-- INSERT/UPDATE/DELETE grants stay in place (e.g. waitlist signup uses anon INSERT only).
-- Authenticated JWTs use `authenticated` (unchanged). Server-only reads use service_role as needed.

REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;

-- Relations created later by the same role that runs migrations: do not re-grant SELECT to anon.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM anon;
