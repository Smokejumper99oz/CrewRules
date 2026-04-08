-- Pilot training deviation: when true, pilot is commuting from home airport to training city
-- (not using company-provided travel from crew base). Drives Commute Assist and Family View routing.
-- null = not yet set, true = deviating, false = using company travel

alter table public.schedule_events
  add column if not exists training_deviation_home_commute boolean;
