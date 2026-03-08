-- Add message_id for Mailgun duplicate detection
alter table public.inbound_email_events
  add column if not exists message_id text;

create unique index if not exists inbound_email_events_message_id_key
  on public.inbound_email_events (message_id)
  where message_id is not null and message_id != '';
