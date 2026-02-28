"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { revalidatePath } from "next/cache";

// IANA format: Region/City or Region/Country/City (e.g. America/Puerto_Rico, America/Argentina/Buenos_Aires)
const VALID_TZ = /^[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)+$/;
// IATA airport code: 3 letters
const VALID_AIRPORT = /^[A-Za-z]{3}$/;

export type UpdateProfileResult = { success: true } | { error: string };

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

  if (fullName && fullName.length > 128) {
    return { error: "Full name is too long" };
  }
  if (employeeNumber && employeeNumber.length > 32) {
    return { error: "Employee number is too long" };
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) return { error: error.message };
  revalidatePath("/frontier/pilots/portal");
  revalidatePath("/frontier/pilots/portal/profile");
  revalidatePath("/frontier/pilots/portal/schedule");
  return { success: true };
}
