-- Set full_name for Super Admin profile so display shows "Sven Folmer" and initials "SF"
update public.profiles
set full_name = 'Sven Folmer'
where id in (select id from auth.users where email = 'svenfolmer92@gmail.com');
