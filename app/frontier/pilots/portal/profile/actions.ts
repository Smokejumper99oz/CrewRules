"use server";

import { addDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createActionClient } from "@/lib/supabase/server-action";
import { getProfile } from "@/lib/profile";
import { revalidatePath } from "next/cache";
import { ensureInboundAliasIfMissing } from "@/lib/email/ensure-inbound-alias-if-missing";

// IANA format: Region/City or Region/Country/City (e.g. America/Puerto_Rico, America/Argentina/Buenos_Aires)
const VALID_TZ = /^[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)+$/;
// IATA airport code: 3 letters
const VALID_AIRPORT = /^[A-Za-z]{3}$/;

export type UpdateProfileResult = { success: true } | { error: string };

export type UpdatePasswordResult = { success: true } | { error: string };

export async function updatePassword(newPassword: string): Promise<UpdatePasswordResult> {
  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };
  return { success: true };
}

export async function updateProfilePreferences(formData: FormData): Promise<UpdateProfileResult> {
  const profile = await getProfile();
  if (!profile) return { error: "Not signed in" };

  const fullName = (formData.get("full_name") as string)?.trim() || null;
  const employeeNumber = (formData.get("employee_number") as string)?.trim() || null;
  const dateOfHireRaw = (formData.get("date_of_hire") as string)?.trim() || null;
  const dateOfHire = dateOfHireRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateOfHireRaw) ? dateOfHireRaw : null;
  const position = (formData.get("position") as string) || null;
  const baseAirport = (formData.get("base_airport") as string)?.trim().toUpperCase() || null;
  const equipment = (formData.get("equipment") as string)?.trim() || null;
  const baseTimezone = (formData.get("base_timezone") as string)?.trim();
  const displayTimezoneMode = (formData.get("display_timezone_mode") as string) || "base";
  const timeFormat = (formData.get("time_format") as string) || "24h";
  const showTimezoneLabel = formData.get("show_timezone_label") === "1";
  const homeAirport = (formData.get("home_airport") as string)?.trim().toUpperCase() || null;
  const alternateHomeAirport = (formData.get("alternate_home_airport") as string)?.trim().toUpperCase() || null;
  const commuteArrivalRaw = (formData.get("commute_arrival_buffer_minutes") as string)?.trim();
  const commuteArrival = commuteArrivalRaw ? parseInt(commuteArrivalRaw, 10) : 180;
  const commuteReleaseRaw = (formData.get("commute_release_buffer_minutes") as string)?.trim();
  const commuteRelease = commuteReleaseRaw ? parseInt(commuteReleaseRaw, 10) : 90;
  const commuteNonstopOnly = formData.get("commute_nonstop_only") === "1";
  const commuteTwoLegEnabled = formData.get("commute_two_leg_enabled") === "1";
  const commuteTwoLegStop1 = (formData.get("commute_two_leg_stop_1") as string)?.trim().toUpperCase() || null;
  const commuteTwoLegStop2 = (formData.get("commute_two_leg_stop_2") as string)?.trim().toUpperCase() || null;
  const showPayProjection = formData.get("show_pay_projection") === "1";
  const familyViewEnabled = formData.get("family_view_enabled") === "1";
  const familyViewShowExactTimes = formData.get("family_view_show_exact_times") === "1";
  const familyViewShowOvernightCities = formData.get("family_view_show_overnight_cities") === "1";
  const familyViewShowCommuteEstimates = formData.get("family_view_show_commute_estimates") === "1";

  if (fullName && fullName.length > 128) {
    return { error: "Full Name is too long" };
  }
  if (employeeNumber && employeeNumber.length > 32) {
    return { error: "Employee Number is too long" };
  }
  if (position && !["captain", "first_officer", "flight_attendant"].includes(position)) {
    return { error: "Invalid role" };
  }
  if (baseAirport && !VALID_AIRPORT.test(baseAirport)) {
    return { error: "Base must be a 3-letter airport code (e.g. SJU)" };
  }
  if (equipment && equipment.length > 64) {
    return { error: "Equipment is too long" };
  }
  if (!baseTimezone || baseTimezone.length > 64) {
    return { error: "Base timezone is required" };
  }
  if (!VALID_TZ.test(baseTimezone)) {
    return { error: "Use IANA format (e.g. America/Puerto_Rico)" };
  }
  if (!["base", "device", "toggle", "both"].includes(displayTimezoneMode)) {
    return { error: "Invalid display mode" };
  }
  if (!["24h", "12h"].includes(timeFormat)) {
    return { error: "Invalid time format" };
  }
  if (homeAirport && !VALID_AIRPORT.test(homeAirport)) {
    return { error: "Home airport must be a 3-letter IATA code" };
  }
  if (alternateHomeAirport && !VALID_AIRPORT.test(alternateHomeAirport)) {
    return { error: "Alternate airport must be a 3-letter IATA code" };
  }
  if (![30, 60, 90, 120, 180].includes(commuteArrival)) {
    return { error: "Invalid commute arrival buffer" };
  }
  if (![0, 30, 60].includes(commuteRelease)) {
    return { error: "Invalid commute release buffer" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      employee_number: employeeNumber,
      date_of_hire: dateOfHire,
      position: position || null,
      base_airport: baseAirport,
      equipment: equipment,
      base_timezone: baseTimezone,
      display_timezone_mode: displayTimezoneMode,
      time_format: timeFormat,
      show_timezone_label: showTimezoneLabel,
      home_airport: homeAirport,
      alternate_home_airport: alternateHomeAirport,
      commute_arrival_buffer_minutes: commuteArrival,
      commute_release_buffer_minutes: commuteRelease,
      commute_nonstop_only: commuteNonstopOnly,
      commute_two_leg_enabled: commuteTwoLegEnabled,
      commute_two_leg_stop_1: commuteTwoLegStop1,
      commute_two_leg_stop_2: commuteTwoLegStop2,
      show_pay_projection: showPayProjection,
      family_view_enabled: familyViewEnabled,
      family_view_show_exact_times: familyViewShowExactTimes,
      family_view_show_overnight_cities: familyViewShowOvernightCities,
      family_view_show_commute_estimates: familyViewShowCommuteEstimates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) return { error: error.message };

  try {
    await ensureInboundAliasIfMissing(profile.id);
  } catch (err) {
    console.warn("[Profile] ensureInboundAliasIfMissing failed:", err);
  }

  revalidatePath("/frontier/pilots/portal");
  revalidatePath("/frontier/pilots/portal/profile");
  revalidatePath("/frontier/pilots/portal/schedule");
  revalidatePath("/frontier/pilots/portal/family-view");
  return { success: true };
}

export async function setShowPayProjection(show: boolean) {
  const supabase = await createActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!profile?.id) throw new Error("Profile not found");

  const { error } = await supabase
    .from("profiles")
    .update({ show_pay_projection: show, updated_at: new Date().toISOString() })
    .eq("id", profile.id);

  if (error) throw error;

  revalidatePath("/frontier/pilots/portal");
  return { ok: true, show_pay_projection: show };
}

export type StartProTrialResult =
  | { ok: false; reason: "profile_missing" }
  | { ok: false; reason: "already_paid" }
  | { ok: false; reason: "trial_active"; pro_trial_expires_at: string }
  | { ok: false; reason: "update_failed"; error: string }
  | { ok: true; pro_trial_expires_at: string };

export async function startProTrial(): Promise<StartProTrialResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, reason: "profile_missing" };

  const tier = profile.subscription_tier;
  if (tier === "pro" || tier === "enterprise") {
    return { ok: false, reason: "already_paid" };
  }

  const expiresAt = profile.pro_trial_expires_at;
  if (expiresAt && typeof expiresAt === "string") {
    const expiresMs = new Date(expiresAt).getTime();
    if (!Number.isNaN(expiresMs) && expiresMs > Date.now()) {
      return { ok: false, reason: "trial_active", pro_trial_expires_at: expiresAt };
    }
  }

  const now = new Date();
  const newStartedAt = now.toISOString();
  const newExpiresAt = addDays(now, 14).toISOString();

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      pro_trial_started_at: newStartedAt,
      pro_trial_expires_at: newExpiresAt,
      updated_at: newStartedAt,
    })
    .eq("id", profile.id);

  if (error) return { ok: false, reason: "update_failed", error: error.message };

  revalidatePath("/frontier/pilots/portal");
  revalidatePath("/frontier/pilots/portal/profile");

  return { ok: true, pro_trial_expires_at: newExpiresAt };
}
