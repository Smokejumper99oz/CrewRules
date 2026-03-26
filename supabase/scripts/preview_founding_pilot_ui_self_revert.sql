-- ONE-OFF: Revert Founding Pilot preview for YOUR profile only.
-- Replace YOUR_PROFILE_ID and YOUR_EMAIL (same as apply script).

UPDATE public.profiles
SET is_founding_pilot     = false,
    founding_pilot_number = null
WHERE id = 'YOUR_PROFILE_ID'::uuid
  AND lower(trim(coalesce(email, ''))) = lower(trim('YOUR_EMAIL'))
RETURNING id, email, is_founding_pilot, founding_pilot_number, founding_pilot_started_at;
