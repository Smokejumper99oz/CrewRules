import type { Profile } from "@/lib/profile";

type PreserveProps = {
  profile: Profile;
  /**
   * When true, omit commute planning fields so the caller can submit them from visible controls
   * (matches Profile “Commute Assist” section field names).
   */
  omitCommutePlanningFields?: boolean;
  /**
   * When true, omit Family View fields so the caller can submit them from visible controls
   * (Settings → Family View).
   */
  omitFamilyViewFields?: boolean;
  /**
   * When true, omit Pay Projection flag so the caller can submit it from visible controls
   * (Settings → Pay Projection).
   */
  omitPayProjectionFields?: boolean;
  /**
   * When true, omit mentor contact fields so the caller can submit them from visible controls
   * (Settings → Community).
   */
  omitMentorFields?: boolean;
};

/**
 * Hidden inputs so `updateProfilePreferences(FormData)` receives unchanged preference flags
 * when saving from a settings subsection (Pilot, Commute Assist, etc.).
 */
export function SettingsProfilePreserveFields({
  profile,
  omitCommutePlanningFields = false,
  omitFamilyViewFields = false,
  omitPayProjectionFields = false,
  omitMentorFields = false,
}: PreserveProps) {
  const displayMode =
    profile.display_timezone_mode === "toggle" ? "both" : (profile.display_timezone_mode ?? "base");
  const commuteArrival = String(profile.commute_arrival_buffer_minutes ?? 60);
  const commuteRelease = String(profile.commute_release_buffer_minutes ?? 30);
  const yn = (b: boolean | undefined) => (b ? "1" : "0");

  return (
    <div className="hidden" aria-hidden>
      <input type="hidden" name="display_timezone_mode" value={displayMode} />
      <input type="hidden" name="time_format" value={profile.time_format ?? "24h"} />
      <input type="hidden" name="show_timezone_label" value={yn(profile.show_timezone_label ?? false)} />
      {!omitCommutePlanningFields && (
        <>
          <input type="hidden" name="commute_arrival_buffer_minutes" value={commuteArrival} />
          <input type="hidden" name="commute_release_buffer_minutes" value={commuteRelease} />
          <input type="hidden" name="commute_nonstop_only" value={profile.commute_nonstop_only !== false ? "1" : "0"} />
          <input type="hidden" name="commute_two_leg_enabled" value={yn(Boolean(profile.commute_two_leg_enabled))} />
          <input type="hidden" name="commute_two_leg_stop_1" value={profile.commute_two_leg_stop_1 ?? ""} />
          <input type="hidden" name="commute_two_leg_stop_2" value={profile.commute_two_leg_stop_2 ?? ""} />
        </>
      )}
      {!omitPayProjectionFields && (
        <input type="hidden" name="show_pay_projection" value={yn(Boolean(profile.show_pay_projection))} />
      )}
      {!omitFamilyViewFields && (
        <>
          <input type="hidden" name="family_view_enabled" value={yn(Boolean(profile.family_view_enabled))} />
          <input type="hidden" name="family_view_show_exact_times" value={yn(profile.family_view_show_exact_times !== false)} />
          <input type="hidden" name="family_view_show_overnight_cities" value={yn(profile.family_view_show_overnight_cities !== false)} />
          <input type="hidden" name="family_view_show_commute_estimates" value={yn(profile.family_view_show_commute_estimates !== false)} />
        </>
      )}
      <input type="hidden" name="color_mode" value={profile.color_mode ?? "dark"} />
      {!omitMentorFields && (
        <>
          <input type="hidden" name="mentor_phone" value={profile.mentor_phone ?? ""} />
          <input type="hidden" name="mentor_contact_email" value={profile.mentor_contact_email ?? ""} />
        </>
      )}
    </div>
  );
}
