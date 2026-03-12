-- Waitlist for non-Frontier users who sign up before their airline is live

create table if not exists public.waitlist (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  requested_portal text not null default 'pilots',
  airline text not null default 'unknown',
  source text not null default 'frontier_signup',
  status text not null default 'pending',
  created_at timestamptz default now(),
  unique (email)
);

alter table public.waitlist enable row level security;

create policy "Allow anonymous inserts"
  on public.waitlist for insert
  with check (
    email is not null
    and length(trim(email)) >= 5
    and length(trim(email)) <= 255
    and email ~* '^[^@]+@[^@]+\.[^@]+$'
  );
