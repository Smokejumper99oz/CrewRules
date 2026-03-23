-- Add SAV (Savannah/Hilton Head) for Commute Assist 2-leg routes (e.g. SAV→ATL→SJU)
-- Redundant with 078 canonical upsert; kept for migration history if already applied.
insert into public.airports (iata, tz) values
  ('SAV', 'America/New_York')
on conflict (iata) do update set tz = excluded.tz;
