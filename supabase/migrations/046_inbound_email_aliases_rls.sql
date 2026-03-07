-- RLS policies for inbound_email_aliases (table created manually in Step 1)
-- Users can read and insert their own alias row

alter table public.inbound_email_aliases enable row level security;

drop policy if exists "Users can read own inbound_email_aliases" on public.inbound_email_aliases;
create policy "Users can read own inbound_email_aliases"
  on public.inbound_email_aliases for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own inbound_email_aliases" on public.inbound_email_aliases;
create policy "Users can insert own inbound_email_aliases"
  on public.inbound_email_aliases for insert
  with check (auth.uid() = user_id);
