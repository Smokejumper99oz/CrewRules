-- Allow authenticated users to read only the pilot-visible FLICA onboarding flag.
-- Admins retain full access via existing is_profile_admin policies on tenant_settings.

create policy "Users can read show_connect_flica_onboarding for their tenant"
  on public.tenant_settings for select
  using (
    key = 'show_connect_flica_onboarding'
    and tenant = (select tenant from public.profiles where id = auth.uid())
    and (
      portal is null
      or portal = (select portal from public.profiles where id = auth.uid())
    )
  );
