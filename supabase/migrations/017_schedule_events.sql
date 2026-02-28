-- Schedule events for pilot/FA schedules (trips, reserve, vacation, off, etc.)
-- Supports ICS import with batch replacement strategy via import_batch_id

create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  portal text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  title text,
  event_type text not null check (event_type in ('trip', 'reserve', 'vacation', 'off', 'other')),
  source text,
  external_uid text,
  import_batch_id uuid,
  imported_at timestamptz not null default now()
);

create index if not exists idx_schedule_events_user_start
  on public.schedule_events (user_id, start_time);

create index if not exists idx_schedule_events_user_source
  on public.schedule_events (user_id, source);

create index if not exists idx_schedule_events_user_batch
  on public.schedule_events (user_id, import_batch_id);

alter table public.schedule_events enable row level security;

drop policy if exists "Users can read own schedule_events" on public.schedule_events;
create policy "Users can read own schedule_events"
  on public.schedule_events for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own schedule_events" on public.schedule_events;
create policy "Users can insert own schedule_events"
  on public.schedule_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own schedule_events" on public.schedule_events;
create policy "Users can update own schedule_events"
  on public.schedule_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own schedule_events" on public.schedule_events;
create policy "Users can delete own schedule_events"
  on public.schedule_events for delete
  using (auth.uid() = user_id);
