"use server";

import { redirect } from "next/navigation";
import { createActionClient } from "@/lib/supabase/server-action";
import { assignInboundAlias } from "@/lib/email/assign-inbound-alias";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { isAcceptedFrontierCrewBaseCode } from "@/lib/frontier-crew-bases";
import { linkMenteeToAssignments } from "@/lib/mentoring/link-mentee-to-assignments";
import { linkMentorToAssignments } from "@/lib/mentoring/link-mentor-to-assignments";
import { linkMentorToPreload } from "@/lib/mentoring/link-mentor-to-preload";

const TENANT = "frontier";
const PORTAL = "pilots";
const PORTAL_PATH = `/${TENANT}/${PORTAL}/portal`;
const LOGIN_PATH = `/${TENANT}/${PORTAL}/login`;

const VALID_AIRPORT = /^[A-Za-z]{3}$/;

export type CreateProfileState = { error?: string } | null;

function isValidCalendarYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function isNotFutureYmd(y: number, m: number, d: number): boolean {
  const now = new Date();
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return new Date(y, m - 1, d, 0, 0, 0, 0) <= endToday;
}

/** Accepts yyyy-mm-dd from {@link DatePickerInput} hidden field, or legacy MM/DD/YYYY. */
function normalizeDateOfHire(input: string): string | null {
  if (!input) return null;

  const trimmed = input.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const y = parseInt(trimmed.slice(0, 4), 10);
    const m = parseInt(trimmed.slice(5, 7), 10);
    const d = parseInt(trimmed.slice(8, 10), 10);
    if (y < 1985 || !isValidCalendarYmd(y, m, d) || !isNotFutureYmd(y, m, d)) return null;
    return trimmed;
  }

  const parts = trimmed.split("/");
  if (parts.length !== 3) return null;

  let [month, day, year] = parts;

  if (year.length === 2) {
    const yy = parseInt(year, 10);
    if (!Number.isFinite(yy)) return null;
    year = yy >= 85 ? String(1900 + yy) : String(2000 + yy);
  }

  if (year.length !== 4) return null;

  const yNum = parseInt(year, 10);
  const mNum = parseInt(month, 10);
  const dNum = parseInt(day, 10);
  if (yNum < 1985 || !isValidCalendarYmd(yNum, mNum, dNum) || !isNotFutureYmd(yNum, mNum, dNum)) return null;

  const mm = month.padStart(2, "0");
  const dd = day.padStart(2, "0");

  return `${year}-${mm}-${dd}`;
}

export async function createProfile(
  _prev: CreateProfileState,
  formData: FormData
): Promise<CreateProfileState> {
  const supabase = await createActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`${LOGIN_PATH}?error=not_signed_in`);
  }

  const email = (user.email ?? "").toLowerCase().trim();
  if (!email.endsWith("@flyfrontier.com")) {
    redirect(`${LOGIN_PATH}?error=company_email_required`);
  }

  const baseAirport = (formData.get("base_airport") as string)?.trim().toUpperCase() || null;
  const position = (formData.get("position") as string)?.trim() || null;
  const dateOfHireRaw = (formData.get("date_of_hire") as string)?.trim() || null;
  const homeAirport = (formData.get("home_airport") as string)?.trim().toUpperCase() || null;
  const alternateHomeAirport = (formData.get("alternate_home_airport") as string)?.trim().toUpperCase() || null;

  if (!baseAirport || !VALID_AIRPORT.test(baseAirport) || !isAcceptedFrontierCrewBaseCode(baseAirport)) {
    return { error: "Please select a valid crew base" };
  }
  if (!position || !["captain", "first_officer", "flight_attendant"].includes(position)) {
    return { error: "Please select your position" };
  }
  if (!dateOfHireRaw) {
    return { error: "Date of hire is required" };
  }
  const normalizedDOH = normalizeDateOfHire(dateOfHireRaw);
  if (!normalizedDOH) {
    return { error: "Invalid date of hire. Use a real calendar date (MM/DD/YY or MM/DD/YYYY)." };
  }
  if (!homeAirport || !VALID_AIRPORT.test(homeAirport)) {
    return { error: "Home airport must be a 3-letter IATA code (e.g. TPA)" };
  }
  if (alternateHomeAirport && !VALID_AIRPORT.test(alternateHomeAirport)) {
    return { error: "Alternate home airport must be a 3-letter IATA code" };
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("full_name, employee_number")
    .eq("id", user.id)
    .maybeSingle();

  const meta = user.user_metadata;
  const metaFullName =
    typeof meta?.full_name === "string" && meta.full_name.trim() !== "" ? meta.full_name.trim() : "";
  const metaEmployeeNumber =
    typeof meta?.employee_number === "string" && meta.employee_number.trim() !== ""
      ? meta.employee_number.trim()
      : "";

  const existingFullName =
    typeof existingProfile?.full_name === "string" && existingProfile.full_name.trim() !== ""
      ? existingProfile.full_name.trim()
      : "";
  const existingEmployeeNumber =
    typeof existingProfile?.employee_number === "string" && existingProfile.employee_number.trim() !== ""
      ? existingProfile.employee_number.trim()
      : "";

  const chosenFullName = existingFullName || metaFullName || "";
  const chosenEmployeeNumber = existingEmployeeNumber || metaEmployeeNumber || "";

  const baseTimezone = getTimezoneFromAirport(baseAirport);

  const upsertPayload: Record<string, unknown> = {
    id: user.id,
    email: user.email ?? null,
    tenant: TENANT,
    portal: PORTAL,
    role: "pilot",
    display_timezone_mode: "base",
    time_format: "24h",
    base_airport: baseAirport,
    base_timezone: baseTimezone,
    position: position,
    date_of_hire: normalizedDOH,
    home_airport: homeAirport,
    alternate_home_airport: alternateHomeAirport || null,
  };

  if (chosenFullName) {
    upsertPayload.full_name = chosenFullName;
  }
  if (chosenEmployeeNumber) {
    upsertPayload.employee_number = chosenEmployeeNumber;
  }

  const { error } = await supabase.from("profiles").upsert(
    upsertPayload,
    { onConflict: "id" }
  );

  if (error) {
    console.error("[createProfile] upsert failed:", error.code, error.message);
    return { error: error.message };
  }

  try {
    await assignInboundAlias(user.id);
  } catch (err) {
    console.warn("[createProfile] alias assignment failed:", err);
  }

  if (chosenEmployeeNumber.trim()) {
    await linkMenteeToAssignments(user.id, chosenEmployeeNumber);
    await linkMentorToAssignments(user.id, chosenEmployeeNumber);
    await linkMentorToPreload(user.id, chosenEmployeeNumber.trim(), TENANT);
  }

  redirect(PORTAL_PATH);
}
