-- Append-only archive of deleted schedule_events rows (Logbook / history).
-- No trigger yet; no changes to schedule_events.

create table public.schedule_events_history (
  id uuid primary key default gen_random_uuid(),
  original_schedule_event_id uuid not null,
  archived_at timestamptz not null default now(),
  archive_reason text,
  deleting_import_batch_id uuid,
  archive_row_version integer not null default 1,

  tenant text not null,
  portal text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  title text,
  event_type text not null,
  source text,
  external_uid text,
  import_batch_id uuid,
  imported_at timestamptz not null,
  report_time text,
  credit_hours numeric(6, 2),
  credit_minutes integer,
  baseline_credit_minutes integer null,
  route text,
  pairing_days integer,
  block_minutes integer,
  is_reserve_assignment boolean not null default false,
  first_leg_departure_time text,
  legs jsonb,
  filed_route text,
  protected_credit_minutes integer not null default 0,
  protected_full_trip_paid_minutes integer,
  is_muted boolean not null default false,
  training_deviation_home_commute boolean
);

comment on table public.schedule_events_history is
  'Archived copies of schedule_events rows at delete time; RLS allows owner read only. No client writes.';

create index idx_schedule_events_history_user_archived_at
  on public.schedule_events_history (user_id, archived_at desc);

create index idx_schedule_events_history_user_start_time
  on public.schedule_events_history (user_id, start_time);

alter table public.schedule_events_history enable row level security;

drop policy if exists "Users can read own schedule_events_history" on public.schedule_events_history;

create policy "Users can read own schedule_events_history"
  on public.schedule_events_history
  for select
  using (auth.uid() = user_id);
