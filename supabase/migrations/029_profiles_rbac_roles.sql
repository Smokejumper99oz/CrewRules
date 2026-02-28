-- RBAC: super_admin, tenant_admin, pilot, flight_attendant
-- Migrate admin->tenant_admin, member+crew_role->pilot|flight_attendant
-- Update handle_new_user for safe defaults (prevents "Database error creating new user")
-- Update RLS policies for new admin roles

-- 1. Drop old role constraint first (so we can set new role values)
alter table public.profiles drop constraint if exists profiles_role_check;

-- 2. Migrate existing data
-- admin -> tenant_admin; member + pilot -> pilot; member + flight_attendant -> flight_attendant
-- Works whether crew_role column exists or not
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'crew_role'
  ) then
    update public.profiles
    set role = case
      when role = 'admin' then 'tenant_admin'
      when role = 'member' and crew_role = 'flight_attendant' then 'flight_attendant'
      else 'pilot'
    end
    where role in ('admin', 'member');
  else
    update public.profiles
    set role = case
      when role = 'admin' then 'tenant_admin'
      else 'pilot'
    end
    where role in ('admin', 'member');
  end if;
end $$;

-- 3. Drop crew_role column and add new role constraint
alter table public.profiles drop column if exists crew_role;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('super_admin', 'tenant_admin', 'pilot', 'flight_attendant'));

comment on column public.profiles.role is 'RBAC: super_admin (app owner), tenant_admin (manage tenant users), pilot, flight_attendant';
-- To set super_admin: update public.profiles set role = 'super_admin' where email = 'your@email.com';

-- 4. Ensure base_airport exists (user calls it "base" - we use base_airport)
-- Already in 019. Ensure position allows Captain/First Officer style (we have captain, first_officer)

-- 5. Tolerant handle_new_user: safe defaults so invite/signup never fails
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r text := coalesce(nullif(trim(new.raw_user_meta_data->>'role'), ''), 'pilot');
begin
  -- Ensure role is valid; default to pilot if not
  if r not in ('super_admin', 'tenant_admin', 'pilot', 'flight_attendant') then
    r := 'pilot';
  end if;
  insert into public.profiles (id, email, tenant, portal, role, plan)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'tenant'), ''), 'frontier'),
    coalesce(nullif(trim(new.raw_user_meta_data->>'portal'), ''), 'pilots'),
    r,
    coalesce(nullif(trim(new.raw_user_meta_data->>'plan'), ''), 'free')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is 'Creates profile on signup. Uses metadata if provided, else safe defaults. ON CONFLICT prevents invite double-create.';

-- 5b. Admins can read profiles in their tenant (for Users list)
create policy "Admins can read tenant profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.role in ('super_admin', 'tenant_admin')
      and (
        p.role = 'super_admin'
        or (p.role = 'tenant_admin' and p.tenant = profiles.tenant)
      )
    )
  );

-- 5c. Admins can update profiles in their tenant (for role changes)
create policy "Admins can update tenant profiles"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.role in ('super_admin', 'tenant_admin')
      and (
        p.role = 'super_admin'
        or (p.role = 'tenant_admin' and p.tenant = profiles.tenant)
      )
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.role in ('super_admin', 'tenant_admin')
      and (
        p.role = 'super_admin'
        or (p.role = 'tenant_admin' and p.tenant = profiles.tenant)
      )
    )
  );

-- 6. Update RLS policies: admin -> super_admin or tenant_admin
-- Storage policies (004)
drop policy if exists "Admins can upload documents" on storage.objects;
create policy "Admins can upload documents"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('super_admin', 'tenant_admin')
    )
  );

drop policy if exists "Admins can update documents" on storage.objects;
create policy "Admins can update documents"
  on storage.objects for update
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('super_admin', 'tenant_admin')
    )
  );

drop policy if exists "Admins can delete documents" on storage.objects;
create policy "Admins can delete documents"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('super_admin', 'tenant_admin')
    )
  );

-- Document chunks (005, 009)
drop policy if exists "Admins can manage document_chunks" on public.document_chunks;
create policy "Admins can manage document_chunks"
  on public.document_chunks for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('super_admin', 'tenant_admin')
    )
  );

-- document_ai_settings (011) - only if table exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'document_ai_settings') then
    drop policy if exists "Admins can manage document_ai_settings" on public.document_ai_settings;
    execute 'create policy "Admins can manage document_ai_settings" on public.document_ai_settings for all using (
      exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in (''super_admin'', ''tenant_admin''))
    )';
  end if;
end $$;

-- document_display_names (012) - only if table exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'document_display_names') then
    drop policy if exists "Admins can manage document_display_names" on public.document_display_names;
    execute 'create policy "Admins can manage document_display_names" on public.document_display_names for all using (
      exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in (''super_admin'', ''tenant_admin''))
    )';
  end if;
end $$;
