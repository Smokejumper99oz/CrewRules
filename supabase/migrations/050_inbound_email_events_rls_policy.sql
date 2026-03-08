-- Fix RLS: inbound_email_events had RLS enabled but no policies (linter 0008).
-- Webhook inserts via service role bypass RLS. Users can read their own events.

alter table public.inbound_email_events enable row level security;

drop policy if exists "Users can read own inbound_email_events" on public.inbound_email_events;
create policy "Users can read own inbound_email_events"
  on public.inbound_email_events for select
  using (auth.uid() = user_id);
