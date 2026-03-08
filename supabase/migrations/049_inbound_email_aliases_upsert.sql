-- Unique on user_id for upsert; update policy for alias assignment
create unique index if not exists inbound_email_aliases_user_id_key
  on public.inbound_email_aliases (user_id);

drop policy if exists "Users can update own inbound_email_aliases" on public.inbound_email_aliases;
create policy "Users can update own inbound_email_aliases"
  on public.inbound_email_aliases for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
