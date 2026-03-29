-- Soft-delete timestamps on profiles. Application enforcement, RLS, and triggers come later.
-- Adds nullable columns only; existing rows receive NULL for both (no rewrites of other columns).

alter table public.profiles
  add column if not exists deleted_at timestamptz null,
  add column if not exists deletion_scheduled_for timestamptz null;

comment on column public.profiles.deleted_at is 'When the account was soft-deleted. Null = not soft-deleted.';
comment on column public.profiles.deletion_scheduled_for is 'When soft-delete is scheduled to finalize. Null = no scheduled deletion.';
