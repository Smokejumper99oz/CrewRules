-- Store per-document AI setting: admins opt-in to AI search per document
-- Default for new uploads: download only (ai_enabled = false)

create table if not exists public.document_ai_settings (
  path text primary key,
  ai_enabled boolean not null default false,
  updated_at timestamptz default now()
);

alter table public.document_ai_settings enable row level security;

create policy "Admins can manage document_ai_settings"
  on public.document_ai_settings for all
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

create policy "Authenticated users can read document_ai_settings"
  on public.document_ai_settings for select
  using (auth.role() = 'authenticated');
