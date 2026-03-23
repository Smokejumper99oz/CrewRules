-- Canonical airport upsert: single source of truth for timezone data.
-- Safe on repeated runs. Keyed on iata. Fills/updates tz for all CrewRules airports.
-- Source: data/airports-canonical.ts
insert into public.airports (iata, tz) values
  ('ATL', 'America/New_York'),
  ('BOS', 'America/New_York'),
  ('CLE', 'America/New_York'),
  ('CLT', 'America/New_York'),
  ('CVG', 'America/New_York'),
  ('DEN', 'America/Denver'),
  ('DFW', 'America/Chicago'),
  ('FLL', 'America/New_York'),
  ('IAH', 'America/Chicago'),
  ('LAS', 'America/Los_Angeles'),
  ('LAX', 'America/Los_Angeles'),
  ('MDW', 'America/Chicago'),
  ('MIA', 'America/New_York'),
  ('MCO', 'America/New_York'),
  ('ORD', 'America/Chicago'),
  ('PHL', 'America/New_York'),
  ('PHX', 'America/Phoenix'),
  ('SAV', 'America/New_York'),
  ('SJU', 'America/Puerto_Rico'),
  ('SFO', 'America/Los_Angeles'),
  ('TPA', 'America/New_York')
on conflict (iata) do update set tz = excluded.tz;
