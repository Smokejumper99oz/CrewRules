-- Trip change summaries from ICS import: shown on dashboard when active trip was updated
create table if not exists public.trip_change_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pairing text not null,
  summary jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_trip_change_summaries_user_created
  on public.trip_change_summaries (user_id, created_at desc);

alter table public.trip_change_summaries enable row level security;

create policy "Users can read own trip_change_summaries"
  on public.trip_change_summaries for select
  using (auth.uid() = user_id);

create policy "Users can insert own trip_change_summaries"
  on public.trip_change_summaries for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own trip_change_summaries"
  on public.trip_change_summaries for delete
  using (auth.uid() = user_id);
