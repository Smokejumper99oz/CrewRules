-- Mentor contact info shown to mentees on the Mentoring portal (not login email).
alter table public.profiles
  add column if not exists mentor_phone text,
  add column if not exists mentor_contact_email text;

comment on column public.profiles.mentor_phone is 'Phone for mentee-facing Mentor card; falls back to phone when null.';
comment on column public.profiles.mentor_contact_email is 'Preferred contact email for mentees; never substitute profiles.email.';

-- Allow mentor and mentee to read counterparty profile rows when linked on mentor_assignments.
drop policy if exists "Users can read counterparty profile in mentor assignment" on public.profiles;
create policy "Users can read counterparty profile in mentor assignment"
  on public.profiles for select
  using (
    exists (
      select 1 from public.mentor_assignments ma
      where
        ma.mentee_user_id is not null
        and (
          (ma.mentor_user_id = auth.uid() and ma.mentee_user_id = profiles.id)
          or (ma.mentee_user_id = auth.uid() and ma.mentor_user_id = profiles.id)
        )
    )
  );
