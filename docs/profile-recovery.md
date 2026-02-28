# Profile Recovery Guide

If you see "User" instead of your name after migration 029, your profile data may be missing or unreachable.

## What the migration did NOT do

- **Did not delete** any profile rows
- **Did not clear** `full_name`, `email`, or other fields
- Only updated `role` and dropped `crew_role`

## Possible causes

1. **Different login** – You might be signed in with a different email/account than before.
2. **Profile row missing** – The profile could have been removed (e.g. via `auth.users` cascade).
3. **RLS blocking read** – A policy might prevent the app from reading your profile.

## Step 1: Diagnose in Supabase

**Supabase Dashboard → SQL Editor** – run:

```sql
-- List all auth users and their profiles
select 
  u.id as auth_id,
  u.email as auth_email,
  p.id as profile_id,
  p.email as profile_email,
  p.full_name,
  p.role,
  p.tenant,
  p.portal
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;
```

Interpretation:

- **Profile row missing** – `profile_id` is null for your user.
- **Profile exists but empty** – `full_name` and `profile_email` are null/empty.
- **Profile looks fine** – Likely RLS or session/caching issue.

## Step 2: Restore or recreate profile

If the profile row is missing or empty, run (replace with your email):

```sql
-- Recreate/restore profile (replace email and values)
insert into public.profiles (id, email, tenant, portal, role, full_name, position, base_airport)
select 
  id,
  email,
  'frontier',
  'pilots',
  'tenant_admin',  -- or 'pilot'
  'Sven Folmer',   -- your full name
  'captain',       -- or 'first_officer'
  'SJU'            -- your base
from auth.users
where email = 'svenfolmer92@gmail.com'
on conflict (id) do update set
  full_name = coalesce(profiles.full_name, excluded.full_name),
  email = coalesce(profiles.email, excluded.email),
  position = coalesce(profiles.position, excluded.position),
  base_airport = coalesce(profiles.base_airport, excluded.base_airport);
```

If the profile exists but `full_name` is empty:

```sql
update public.profiles
set full_name = 'Sven Folmer', email = coalesce(email, 'svenfolmer92@gmail.com')
where email = 'svenfolmer92@gmail.com' or id in (select id from auth.users where email = 'svenfolmer92@gmail.com');
```

## Step 3: Re-login

After updating the profile, sign out and sign back in to refresh the session.
