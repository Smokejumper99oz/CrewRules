-- ONE-OFF: Apply Founding Pilot preview for YOUR profile only.
-- Replace YOUR_PROFILE_ID and YOUR_EMAIL. Run in Supabase SQL Editor.
-- Revert: preview_founding_pilot_ui_self_revert.sql (same placeholders).
-- Profile id = auth user UUID (Dashboard → Authentication → Users).
-- If UNIQUE(founding_pilot_number) fails, pick a free number or see who has 1:
--   SELECT id, email, founding_pilot_number FROM public.profiles WHERE founding_pilot_number = 1;
-- founding_pilot_started_at not set — not needed for header UI when number is present.

SELECT id, email, is_founding_pilot, founding_pilot_number, founding_pilot_started_at
FROM public.profiles
WHERE id = 'YOUR_PROFILE_ID'::uuid
  AND lower(trim(coalesce(email, ''))) = lower(trim('YOUR_EMAIL'));

UPDATE public.profiles
SET is_founding_pilot     = true,
    founding_pilot_number = 1
WHERE id = 'YOUR_PROFILE_ID'::uuid
  AND lower(trim(coalesce(email, ''))) = lower(trim('YOUR_EMAIL'))
RETURNING id, email, is_founding_pilot, founding_pilot_number, founding_pilot_started_at;
