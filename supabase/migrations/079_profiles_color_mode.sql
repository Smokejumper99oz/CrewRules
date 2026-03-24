-- Theme/appearance preference: dark, light, or system (follow OS)
-- Default 'dark' preserves current behavior

alter table public.profiles
  add column if not exists color_mode text not null default 'dark'
    check (color_mode in ('dark', 'light', 'system'));

comment on column public.profiles.color_mode is 'Theme: dark, light, or system (follow device preference).';
