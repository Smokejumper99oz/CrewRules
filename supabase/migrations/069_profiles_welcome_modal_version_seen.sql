-- Add welcome_modal_version_seen for versioned first-login onboarding.
-- Null = never seen. Integer = last version seen. Used to show/force future onboarding updates.
alter table public.profiles
  add column if not exists welcome_modal_version_seen integer default null;

comment on column public.profiles.welcome_modal_version_seen is 'Last welcome modal version the user has seen. Null = never seen. Used for versioned first-login onboarding; bumping CURRENT_WELCOME_MODAL_VERSION will re-show the modal for users who have not seen the new version.';
