-- Store display names for documents (e.g., "Frontier Airlines CBA" instead of "fft-cba-loa-31_...")

create table if not exists public.document_display_names (
  path text primary key,
  display_name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.document_display_names enable row level security;

create policy "Admins can manage document_display_names"
  on public.document_display_names for all
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

create policy "Authenticated users can read document_display_names"
  on public.document_display_names for select
  using (auth.role() = 'authenticated');
