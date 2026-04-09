import type { Profile } from "@/lib/profile";
import { getFrontierBidPeriodTimezone } from "@/lib/frontier-bid-periods";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { TENANT_CONFIG } from "@/lib/tenant-config";
import type { ScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";

/**
 * Same mapping as getScheduleDisplaySettings() when a profile row is already loaded (e.g. public viewer).
 */
export function scheduleDisplaySettingsFromProfile(profile: Profile): ScheduleDisplaySettings {
  const mode = profile.display_timezone_mode ?? "base";
  const baseAirport = profile.base_airport ?? null;
  const baseTimezone = getFrontierBidPeriodTimezone({
    baseTimezone: profile.base_timezone ?? (baseAirport ? getTimezoneFromAirport(baseAirport) : null),
    profileBaseTimezone: profile.base_timezone,
  });
  const carrierCode = (profile.tenant && TENANT_CONFIG[profile.tenant]?.carrier) ?? null;
  return {
    baseTimezone,
    baseAirport,
    displayTimezoneMode: mode === "toggle" ? "both" : mode,
    timeFormat: profile.time_format ?? "24h",
    showTimezoneLabel: profile.show_timezone_label ?? false,
    carrierCode,
  };
}
