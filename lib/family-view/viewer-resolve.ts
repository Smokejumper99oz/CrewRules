import "server-only";

import { addDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { familyViewInviteTokenHashFromRaw } from "@/lib/family-view/invite-token";
import { mergeFamilyViewScheduleEvents } from "@/lib/family-view/merge-family-view-events";
import type { Profile } from "@/lib/profile";
import type { ScheduleEvent, ScheduleEventLeg } from "@/app/frontier/pilots/portal/schedule/actions";
import { scheduleDisplaySettingsFromProfile } from "@/lib/family-view/schedule-display-from-profile";
import type { ScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import { todayStr } from "@/lib/leg-dates";
import type { SupabaseClient } from "@supabase/supabase-js";

const FLICA_SOURCE = "flica_import";

const SCHEDULE_SELECT =
  "id, start_time, end_time, title, event_type, report_time, credit_hours, credit_minutes, baseline_credit_minutes, protected_credit_minutes, protected_full_trip_paid_minutes, route, pairing_days, block_minutes, first_leg_departure_time, legs, is_muted, import_batch_id, imported_at, training_release_time, training_schedule_detail, training_deviation_home_commute";

function isVacationCodeFamilyView(title: string | null | undefined): boolean {
  const t = (title ?? "").trim().toUpperCase();
  return /^V\d+$/.test(t);
}

async function fetchLastEndedDutyTouchingTodayAdmin(
  admin: SupabaseClient,
  pilotId: string,
  baseTimezone: string
): Promise<ScheduleEvent | null> {
  const nowIso = new Date().toISOString();
  const todayYmd = todayStr(baseTimezone);
  let startOfTodayUtc: string;
  try {
    startOfTodayUtc = fromZonedTime(`${todayYmd}T00:00:00.000`, baseTimezone).toISOString();
  } catch {
    return null;
  }

  const { data, error } = await admin
    .from("schedule_events")
    .select(SCHEDULE_SELECT)
    .eq("user_id", pilotId)
    .eq("source", FLICA_SOURCE)
    .in("event_type", ["trip", "reserve", "training"])
    .or("is_muted.eq.false,is_muted.is.null")
    .gte("end_time", startOfTodayUtc)
    .lt("end_time", nowIso)
    .order("end_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const ev = data as ScheduleEvent;
  if (isVacationCodeFamilyView(ev.title)) return null;
  return ev;
}

export type FamilyViewViewerResolveInvalid = { ok: false; reason: "invalid" };
export type FamilyViewViewerResolveUnavailable = { ok: false; reason: "unavailable" };
export type FamilyViewViewerResolveSuccess = {
  ok: true;
  profile: Profile;
  events: ScheduleEvent[];
  displaySettings: ScheduleDisplaySettings;
};

export type FamilyViewViewerResolveResult =
  | FamilyViewViewerResolveInvalid
  | FamilyViewViewerResolveUnavailable
  | FamilyViewViewerResolveSuccess;

function extractTrainingCityFromLegs(
  legs: ScheduleEventLeg[],
  baseAirport: string | null | undefined
): string | null {
  if (!legs || legs.length === 0) return null;
  const base = (baseAirport ?? "").trim().toUpperCase();

  let bestLeg: ScheduleEventLeg | null = null;
  let bestBlock = -1;
  for (const leg of legs) {
    const dest = (leg.destination ?? "").trim().toUpperCase();
    if (!dest || dest === base) continue;
    const block = leg.blockMinutes ?? 0;
    if (block > bestBlock) {
      bestBlock = block;
      bestLeg = leg;
    }
  }
  if (bestLeg?.destination) return bestLeg.destination.trim().toUpperCase();

  for (const leg of legs) {
    const dest = (leg.destination ?? "").trim().toUpperCase();
    if (dest && dest !== base) return dest;
  }
  return null;
}

/**
 * Server-only: validate invite token and load pilot schedule for Family View (service role).
 * Does not expose whether an email matched; invalid vs expired vs revoked are all "invalid" to the caller UI.
 */
export async function resolveFamilyViewViewerByRawToken(
  rawToken: string | undefined | null
): Promise<FamilyViewViewerResolveResult> {
  const trimmed = (rawToken ?? "").trim();
  if (!trimmed) return { ok: false, reason: "invalid" };

  const tokenHash = familyViewInviteTokenHashFromRaw(trimmed);
  if (!tokenHash) return { ok: false, reason: "invalid" };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const nowIso = new Date().toISOString();

  const { data: invite, error: inviteErr } = await admin
    .from("family_view_invites")
    .select("pilot_profile_id")
    .eq("token_hash", tokenHash)
    .eq("status", "pending")
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (inviteErr || !invite?.pilot_profile_id) {
    return { ok: false, reason: "invalid" };
  }

  const pilotId = invite.pilot_profile_id as string;

  const { data: profileRow, error: profileErr } = await admin
    .from("profiles")
    .select("*")
    .eq("id", pilotId)
    .maybeSingle();

  if (profileErr || !profileRow) {
    return { ok: false, reason: "unavailable" };
  }

  const profile = profileRow as Profile;
  if (!profile.family_view_enabled) {
    return { ok: false, reason: "unavailable" };
  }

  const now = new Date();
  const fromIso = now.toISOString();
  const toIso = addDays(now, 35).toISOString();

  const { data: eventRows, error: eventsErr } = await admin
    .from("schedule_events")
    .select(SCHEDULE_SELECT)
    .eq("user_id", pilotId)
    .eq("source", FLICA_SOURCE)
    .lte("start_time", toIso)
    .gte("end_time", fromIso)
    .order("start_time", { ascending: true });

  if (eventsErr) {
    return { ok: false, reason: "unavailable" };
  }

  const displaySettings = scheduleDisplaySettingsFromProfile(profile);
  const baseTz = displaySettings.baseTimezone ?? "America/Denver";
  const lastEndedToday = await fetchLastEndedDutyTouchingTodayAdmin(admin, pilotId, baseTz);
  const events = mergeFamilyViewScheduleEvents(
    (eventRows ?? []) as ScheduleEvent[],
    lastEndedToday
  );

  return { ok: true, profile, events, displaySettings };
}

/** Training city lookup for a pilot id (mirrors getTrainingCityForEvent companion-trip query). */
export async function fetchTrainingCityForPilotUserId(
  pilotUserId: string,
  baseAirport: string | null | undefined,
  eventTitle: string | null,
  startTime: string,
  endTime: string
): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("schedule_events")
      .select("legs, title")
      .eq("user_id", pilotUserId)
      .eq("source", FLICA_SOURCE)
      .eq("event_type", "trip")
      .lt("start_time", endTime)
      .gt("end_time", startTime)
      .order("start_time", { ascending: true })
      .limit(5);

    if (!data || data.length === 0) return null;

    const trainingTitle = (eventTitle ?? "").trim().toUpperCase();
    const companion =
      data.find((row) => {
        const t = ((row as { title?: string | null }).title ?? "").trim().toUpperCase();
        return t && trainingTitle && (t.startsWith(trainingTitle) || trainingTitle.startsWith(t));
      }) ?? data[0];

    const legs = ((companion as { legs?: unknown }).legs as ScheduleEventLeg[] | null) ?? [];
    return extractTrainingCityFromLegs(legs, baseAirport);
  } catch {
    return null;
  }
}
