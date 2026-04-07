-- Migration 144: mentoring_contacts
-- Per-tenant contact cards shown on the mentee Important Contacts page.
-- Admins manage entries for their own tenant; pilots read their tenant's rows.

create table if not exists public.mentoring_contacts (
  id           uuid        not null default gen_random_uuid() primary key,
  tenant       text        not null,
  portal       text        not null default 'pilots',
  title        text        not null,
  subtitle     text        not null default '',
  icon_key     text        not null default 'users',
  sort_order   integer     not null default 0,
  entries      jsonb       not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Index for fast tenant/portal lookups
create index if not exists mentoring_contacts_tenant_portal_idx
  on public.mentoring_contacts (tenant, portal, sort_order);

-- Updated_at trigger
create or replace function public.set_mentoring_contacts_updated_at()
returns trigger language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger mentoring_contacts_set_updated_at
  before update on public.mentoring_contacts
  for each row execute function public.set_mentoring_contacts_updated_at();

-- RLS
alter table public.mentoring_contacts enable row level security;

-- Authenticated pilots can read contact rows that match their own tenant + portal
create policy "pilots_read_own_tenant_contacts"
  on public.mentoring_contacts
  for select
  to authenticated
  using (
    tenant = (select tenant from public.profiles where id = auth.uid() limit 1)
    and
    portal = (select portal from public.profiles where id = auth.uid() limit 1)
  );

-- Service role (used by admin server actions) bypasses RLS — no additional policy needed.
-- Admin writes go through createAdminClient() which uses the service role key.

-- Seed Frontier Airlines pilot contacts so the page isn't empty after migration
insert into public.mentoring_contacts (tenant, portal, title, subtitle, icon_key, sort_order, entries)
values
  (
    'frontier', 'pilots',
    'ALPA Mentorship Program',
    'Frontier MEC Membership Committee — Air Line Pilots Association, International',
    'users',
    1,
    '[
      {"label": "Program Manager", "value": "Capt. Justin Miller"},
      {"label": "Role",            "value": "NH Mentorship Program Manager"},
      {"label": "Committee",       "value": "Frontier MEC Membership Committee"},
      {"label": "Mobile",          "value": "(734) 730-7955", "href": "tel:+17347307955"},
      {"label": "Email",           "value": "justin.miller@alpa.org", "href": "mailto:justin.miller@alpa.org"},
      {"label": "ALPA Website",    "value": "alpa.org", "href": "https://www.alpa.org"}
    ]'::jsonb
  ),
  (
    'frontier', 'pilots',
    'Military Affairs Committee',
    'Frontier MEC Military Affairs — Air Line Pilots Association, International',
    'shield',
    2,
    '[
      {"label": "Chairman",      "value": "Capt. Stephen Sorbie"},
      {"label": "Committee",     "value": "Frontier MEC Military Affairs Committee"},
      {"label": "Mobile",        "value": "(727) 481-1309", "href": "tel:+17274811309"},
      {"label": "Frontier MEC",  "value": "fft.alpa.org", "href": "https://fft.alpa.org"}
    ]'::jsonb
  ),
  (
    'frontier', 'pilots',
    'Payroll & Compensation',
    'Questions about pay, probation period pay rates, or paycheck issues',
    'dollar',
    3,
    '[
      {"label": "Frontier HR / Payroll", "value": "Contact Frontier HR"},
      {"label": "ALPA Contract",         "value": "Pay questions via your local"}
    ]'::jsonb
  );
