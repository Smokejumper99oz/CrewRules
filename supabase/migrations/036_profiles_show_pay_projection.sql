alter table public.profiles
  add column if not exists show_pay_projection boolean not null default false;
