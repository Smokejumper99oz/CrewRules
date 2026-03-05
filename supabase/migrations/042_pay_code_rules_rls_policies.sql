-- Ensure pay_code_rules has RLS policies (fixes linter: rls_enabled_no_policy)
-- Drop first in case they exist from a partial 041 run, then recreate.

drop policy if exists "Users can read pay_code_rules for their tenant" on public.pay_code_rules;
drop policy if exists "Admins can insert pay_code_rules" on public.pay_code_rules;
drop policy if exists "Admins can update pay_code_rules" on public.pay_code_rules;
drop policy if exists "Admins can delete pay_code_rules" on public.pay_code_rules;

create policy "Users can read pay_code_rules for their tenant"
  on public.pay_code_rules for select
  using (
    tenant = (select tenant from public.profiles where id = auth.uid())
  );

create policy "Admins can insert pay_code_rules"
  on public.pay_code_rules for insert
  with check (is_profile_admin(tenant));

create policy "Admins can update pay_code_rules"
  on public.pay_code_rules for update
  using (is_profile_admin(tenant))
  with check (is_profile_admin(tenant));

create policy "Admins can delete pay_code_rules"
  on public.pay_code_rules for delete
  using (is_profile_admin(tenant));
