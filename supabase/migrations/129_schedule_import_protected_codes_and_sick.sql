-- Sick event type on schedule_events + data-driven protected import codes (exact SUMMARY match).

-- 1) Allow event_type = sick on schedule_events
alter table public.schedule_events
  drop constraint if exists schedule_events_event_type_check;

alter table public.schedule_events
  add constraint schedule_events_event_type_check
  check (event_type in ('trip', 'reserve', 'vacation', 'off', 'other', 'pay', 'sick'));

-- 2) Protected codes: classification + baseline preservation (add rows in DB; no import code change)
create table public.schedule_import_protected_codes (
  id uuid primary key default gen_random_uuid(),
  tenant text,
  code text not null,
  normalized_code text generated always as (upper(trim(code))) stored,
  event_type text not null,
  preserve_on_baseline_replace boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint schedule_import_protected_codes_event_type_check check (
    event_type in ('trip', 'reserve', 'vacation', 'off', 'other', 'pay', 'sick')
  )
);

create unique index schedule_import_protected_codes_tenant_norm_code_uidx
  on public.schedule_import_protected_codes (coalesce(tenant, ''), normalized_code);

comment on table public.schedule_import_protected_codes is
  'Exact-match SUMMARY codes for FLICA import: maps to event_type and optional baseline preservation.';

alter table public.schedule_import_protected_codes enable row level security;

create policy "Users read schedule_import_protected_codes for tenant"
  on public.schedule_import_protected_codes
  for select
  to authenticated
  using (
    tenant is null
    or tenant = (select p.tenant from public.profiles p where p.id = auth.uid() limit 1)
  );

-- Seed (Frontier pilot PAY / SICK)
insert into public.schedule_import_protected_codes (tenant, code, event_type, preserve_on_baseline_replace, active)
values
  ('frontier', 'PAY', 'pay', true, true),
  ('frontier', 'SICK', 'sick', true, true);
