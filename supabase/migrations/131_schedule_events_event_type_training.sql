-- Allow schedule_events.event_type = training (recurrent training from ICS DESCRIPTION markers).

alter table public.schedule_events
  drop constraint if exists schedule_events_event_type_check;

alter table public.schedule_events
  add constraint schedule_events_event_type_check
  check (event_type in ('trip', 'reserve', 'vacation', 'off', 'other', 'pay', 'sick', 'training'));

alter table public.schedule_import_protected_codes
  drop constraint if exists schedule_import_protected_codes_event_type_check;

alter table public.schedule_import_protected_codes
  add constraint schedule_import_protected_codes_event_type_check
  check (event_type in ('trip', 'reserve', 'vacation', 'off', 'other', 'pay', 'sick', 'training'));
