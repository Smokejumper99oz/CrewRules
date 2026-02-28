-- Backfill NULL external_uid so we can add unique constraint (required for upsert)
update public.schedule_events
set external_uid = 'legacy-' || id::text
where external_uid is null;

-- Unique constraint for upsert by user_id + external_uid
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'schedule_events_user_external_uid_key'
  ) then
    alter table public.schedule_events
      add constraint schedule_events_user_external_uid_key
      unique (user_id, external_uid);
  end if;
end $$;
