-- Airports table for IATA → timezone lookup (Commute Assist, schedule display)
create table if not exists public.airports (
  iata text primary key,
  tz text not null
);

alter table public.airports enable row level security;

-- Public read (anyone can look up airport timezones)
create policy "Anyone can read airports"
  on public.airports for select
  using (true);

-- Seed: Frontier bases + common commute cities
insert into public.airports (iata, tz) values
  ('DEN', 'America/Denver'),
  ('MCO', 'America/New_York'),
  ('TPA', 'America/New_York'),
  ('ATL', 'America/New_York'),
  ('LAX', 'America/Los_Angeles'),
  ('LAS', 'America/Los_Angeles'),
  ('PHX', 'America/Phoenix'),
  ('DFW', 'America/Chicago'),
  ('CLT', 'America/New_York'),
  ('ORD', 'America/Chicago'),
  ('IAH', 'America/Chicago'),
  ('SJU', 'America/Puerto_Rico'),
  ('MIA', 'America/New_York'),
  ('FLL', 'America/New_York'),
  ('BOS', 'America/New_York'),
  ('SFO', 'America/Los_Angeles')
on conflict (iata) do update set tz = excluded.tz;
