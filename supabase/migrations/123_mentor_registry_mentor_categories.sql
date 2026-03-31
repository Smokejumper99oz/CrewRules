-- Multi-category mentor program (Phase 1): array on mentor_registry; legacy mentor_type kept in sync when exactly one category.

alter table public.mentor_registry
  add column if not exists mentor_categories text[] not null default '{}';

comment on column public.mentor_registry.mentor_categories is
  'Mentor program categories (nh_mentor, captain_mentor, potential_mentor, company_mentor). Source of truth when multiple; legacy mentor_type still populated when exactly one category.';

update public.mentor_registry
set mentor_categories = case mentor_type
  when 'nh_mentor' then array['nh_mentor']::text[]
  when 'captain_mentor' then array['captain_mentor']::text[]
  when 'potential_mentor' then array['potential_mentor']::text[]
  when 'company_mentor' then array['company_mentor']::text[]
  else '{}'::text[]
end
where mentor_type is not null;
