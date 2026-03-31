-- Staging identity on mentor_preload; mentor program metadata in mentor_registry (no duplicated profile identity).

alter table public.mentor_preload
  add column if not exists position text,
  add column if not exists base_airport text;

comment on column public.mentor_preload.position is
  'Staging crew position before a CrewRules profile exists; same allowed values as profiles.position.';
comment on column public.mentor_preload.base_airport is
  'Staging base IATA (3 letters) before a CrewRules profile exists; aligns with profiles.base_airport after link.';

alter table public.mentor_preload
  drop constraint if exists mentor_preload_position_check;

alter table public.mentor_preload
  add constraint mentor_preload_position_check
  check (
    position is null
    or position in ('captain', 'first_officer', 'flight_attendant')
  );

create table public.mentor_registry (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  preload_id uuid references public.mentor_preload (id) on delete cascade,
  mentor_type text,
  mentor_status text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentor_registry_profile_xor_preload_chk check (
    (profile_id is not null and preload_id is null)
    or (profile_id is null and preload_id is not null)
  )
);

comment on table public.mentor_registry is
  'Mentor program fields only (type, status, admin notes). Identity stays on profiles or mentor_preload until link.';

create unique index mentor_registry_profile_id_unique
  on public.mentor_registry (profile_id)
  where profile_id is not null;

create unique index mentor_registry_preload_id_unique
  on public.mentor_registry (preload_id)
  where preload_id is not null;

create index mentor_registry_updated_at_idx
  on public.mentor_registry (updated_at desc);

alter table public.mentor_registry enable row level security;

create policy "Admins can read mentor_registry"
  on public.mentor_registry for select
  using (
    (
      profile_id is not null
      and exists (
        select 1 from public.profiles p
        where p.id = mentor_registry.profile_id
          and public.is_profile_admin(p.tenant)
      )
    )
    or (
      preload_id is not null
      and exists (
        select 1 from public.mentor_preload mp
        where mp.id = mentor_registry.preload_id
          and public.is_profile_admin(mp.tenant)
      )
    )
  );

create policy "Admins can insert mentor_registry"
  on public.mentor_registry for insert
  with check (
    (
      profile_id is not null
      and exists (
        select 1 from public.profiles p
        where p.id = mentor_registry.profile_id
          and public.is_profile_admin(p.tenant)
      )
    )
    or (
      preload_id is not null
      and exists (
        select 1 from public.mentor_preload mp
        where mp.id = mentor_registry.preload_id
          and public.is_profile_admin(mp.tenant)
      )
    )
  );

create policy "Admins can update mentor_registry"
  on public.mentor_registry for update
  using (
    (
      profile_id is not null
      and exists (
        select 1 from public.profiles p
        where p.id = mentor_registry.profile_id
          and public.is_profile_admin(p.tenant)
      )
    )
    or (
      preload_id is not null
      and exists (
        select 1 from public.mentor_preload mp
        where mp.id = mentor_registry.preload_id
          and public.is_profile_admin(mp.tenant)
      )
    )
  )
  with check (
    (
      profile_id is not null
      and exists (
        select 1 from public.profiles p
        where p.id = mentor_registry.profile_id
          and public.is_profile_admin(p.tenant)
      )
    )
    or (
      preload_id is not null
      and exists (
        select 1 from public.mentor_preload mp
        where mp.id = mentor_registry.preload_id
          and public.is_profile_admin(mp.tenant)
      )
    )
  );

create policy "Admins can delete mentor_registry"
  on public.mentor_registry for delete
  using (
    (
      profile_id is not null
      and exists (
        select 1 from public.profiles p
        where p.id = mentor_registry.profile_id
          and public.is_profile_admin(p.tenant)
      )
    )
    or (
      preload_id is not null
      and exists (
        select 1 from public.mentor_preload mp
        where mp.id = mentor_registry.preload_id
          and public.is_profile_admin(mp.tenant)
      )
    )
  );
