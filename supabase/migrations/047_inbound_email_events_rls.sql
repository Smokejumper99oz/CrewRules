-- RLS policies for inbound_email_events
-- Webhook inserts via service role (bypasses RLS). Users can read their own events.

alter table public.inbound_email_events enable row level security;

drop policy if exists "Users can read own inbound_email_events" on public.inbound_email_events;
create policy "Users can read own inbound_email_events"
  on public.inbound_email_events for select
  using (auth.uid() = user_id);
