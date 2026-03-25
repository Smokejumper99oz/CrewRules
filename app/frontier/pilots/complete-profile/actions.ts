"use server";

import { redirect } from "next/navigation";
import { createActionClient } from "@/lib/supabase/server-action";
import { assignInboundAlias } from "@/lib/email/assign-inbound-alias";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { isAcceptedFrontierCrewBaseCode } from "@/lib/frontier-crew-bases";

const TENANT = "frontier";
const PORTAL = "pilots";
const PORTAL_PATH = `/${TENANT}/${PORTAL}/portal`;
const LOGIN_PATH = `/${TENANT}/${PORTAL}/login`;

const VALID_AIRPORT = /^[A-Za-z]{3}$/;

export type CreateProfileState = { error?: string } | null;

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
  const dateOfHire = dateOfHireRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateOfHireRaw) ? dateOfHireRaw : null;
  const homeAirport = (formData.get("home_airport") as string)?.trim().toUpperCase() || null;
  const alternateHomeAirport = (formData.get("alternate_home_airport") as string)?.trim().toUpperCase() || null;

  if (!baseAirport || !VALID_AIRPORT.test(baseAirport) || !isAcceptedFrontierCrewBaseCode(baseAirport)) {
    return { error: "Please select a valid crew base" };
  }
  if (!position || !["captain", "first_officer", "flight_attendant"].includes(position)) {
    return { error: "Please select your position" };
  }
  if (!dateOfHire) {
    return { error: "Date of hire is required" };
  }
  if (!homeAirport || !VALID_AIRPORT.test(homeAirport)) {
    return { error: "Home airport must be a 3-letter IATA code (e.g. TPA)" };
  }
  if (alternateHomeAirport && !VALID_AIRPORT.test(alternateHomeAirport)) {
    return { error: "Alternate home airport must be a 3-letter IATA code" };
  }

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
    date_of_hire: dateOfHire,
    home_airport: homeAirport,
    alternate_home_airport: alternateHomeAirport || null,
  };

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

  redirect(PORTAL_PATH);
}
