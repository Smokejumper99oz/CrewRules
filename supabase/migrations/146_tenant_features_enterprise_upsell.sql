-- Migration 146: RLS policy for tenant_features + show_enterprise_programs flag
--
-- Migration 145 enabled RLS on tenant_features but the policy was added to the
-- file after it had already been applied. This migration backfills the missing
-- policy and seeds the new show_enterprise_programs flag.

-- RLS policy (idempotent via DO block)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'tenant_features'
      and policyname = 'Super admins can read tenant_features'
  ) then
    execute $policy$
      create policy "Super admins can read tenant_features"
        on public.tenant_features
        for select
        using (
          exists (
            select 1 from public.profiles
            where id = auth.uid()
              and role = 'super_admin'
          )
        )
    $policy$;
  end if;
end;
$$;

-- Seed the enterprise upsell visibility flag (off by default)
insert into public.tenant_features (tenant, portal, feature_key, enabled, notes)
values
  ('frontier', 'pilots', 'show_enterprise_programs', false,
   'Show locked Enterprise Programs upsell section on admin dashboard')
on conflict (tenant, portal, feature_key) do nothing;
