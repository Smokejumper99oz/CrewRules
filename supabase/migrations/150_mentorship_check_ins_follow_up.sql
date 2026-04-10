alter table public.mentorship_check_ins
  add column if not exists follow_up_category text not null default 'none'
    check (follow_up_category in ('none', 'needs_admin_follow_up'));

alter table public.mentorship_check_ins
  add column if not exists follow_up_date date null;

comment on column public.mentorship_check_ins.follow_up_category is
  'Check-in classification for ops: none = standard; needs_admin_follow_up = surface to admin follow-up.';

comment on column public.mentorship_check_ins.follow_up_date is
  'Optional date to revisit or target for follow-up (e.g. admin or mentor).';
