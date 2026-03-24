-- Super Admin Users page: is_admin, is_mentor, phone.
-- Minimal extension; role remains source of truth for permissions.
-- is_admin/is_mentor kept in sync by app for display/eligibility.

alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists is_mentor boolean not null default false,
  add column if not exists phone text;

comment on column public.profiles.is_admin is 'Eligibility flag for Super Admin Users UI. Synced with role in (tenant_admin, super_admin).';
comment on column public.profiles.is_mentor is 'Eligibility for mentor assignment. Set via Super Admin Users.';
comment on column public.profiles.phone is 'User phone number. Editable in Super Admin Users.';

-- Sync existing admins
update public.profiles
set is_admin = true
where role in ('tenant_admin', 'super_admin');
