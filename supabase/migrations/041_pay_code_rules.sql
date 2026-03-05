-- Pay code rules: hours per day for vacation, sick, etc. by tenant/role.
-- Enables configurable pay without code changes (e.g. V35 = 5.0 hrs/day).

create table if not exists public.pay_code_rules (
  id uuid default gen_random_uuid() primary key,
  tenant text not null,
  role text not null check (role in ('pilot', 'flight_attendant')),
  code text not null,
  hours_per_day numeric not null,
  effective_from date,
  effective_to date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index pay_code_rules_tenant_role_code_key
  on public.pay_code_rules (tenant, role, code);

comment on table public.pay_code_rules is 'Pay credit rules: hours per day for codes like V35, V15, SICK. Lookup by tenant/role/code.';

alter table public.pay_code_rules enable row level security;

-- Users can read pay_code_rules for their tenant (needed for schedule stats)
create policy "Users can read pay_code_rules for their tenant"
  on public.pay_code_rules for select
  using (
    tenant = (select tenant from public.profiles where id = auth.uid())
  );

-- Admins can manage pay_code_rules
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

-- Seed Frontier pilot V35 default (5.0 hrs/day)
insert into public.pay_code_rules (tenant, role, code, hours_per_day)
values ('frontier', 'pilot', 'V35', 5.0)
on conflict (tenant, role, code) do update set hours_per_day = 5.0;
