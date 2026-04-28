"use server";

import { addDays } from "date-fns";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createActionClient } from "@/lib/supabase/server-action";
import { getProfile } from "@/lib/profile";
import { CURRENT_WELCOME_MODAL_VERSION } from "@/lib/welcome-modal";
import {
  getApplicablePbsBidOpeningUtc,
  getBidReminderMonthKey,
  isInPbsBidReminderWindow,
  PBS_BID_REMINDER_FALLBACK_TZ,
} from "@/lib/bid-reminder/pbs-monthly-bid-window";
import { revalidatePath } from "next/cache";
import { ensureInboundAliasIfMissing } from "@/lib/email/ensure-inbound-alias-if-missing";
import { formatUsPhoneDisplay } from "@/lib/format-us-phone";
import {
  isProfileEmployeeNumberTaken,
  PROFILE_EMPLOYEE_NUMBER_TAKEN_ERROR,
} from "@/lib/profiles/employee-number-taken";
import {
  generateFamilyViewInviteTokenPair,
  normalizeFamilyViewInviteEmail,
} from "@/lib/family-view/invite-token";
import { sendFamilyViewInviteEmail } from "@/lib/email/send-family-view-invite";

// IANA format: Region/City or Region/Country/City (e.g. America/Puerto_Rico, America/Argentina/Buenos_Aires)
const VALID_TZ = /^[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)+$/;
// IATA airport code: 3 letters
const VALID_AIRPORT = /^[A-Za-z]{3}$/;

export type UpdateProfileResult = { success: true } | { error: string };

export type UpdatePasswordResult = { success: true } | { error: string };

export type ScheduleAccountDeletionResult =
  | { success: true }
  | { success: true; alreadyScheduled: true }
  | { error: string };

const MAX_DELETION_REASON_LENGTH = 2000;

function normalizeDeletionReason(raw: string | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  return t.length ? t : null;
}

/**
 * Schedules soft-delete on the current user's profile (does not touch auth.users or sessions).
 * Idempotent: if deletion is already scheduled or recorded, returns without changing timestamps.
 *
 * @param reason Optional user-provided reason (max {@link MAX_DELETION_REASON_LENGTH} chars after trim).
 */
export async function scheduleAccountDeletion(reason?: string): Promise<ScheduleAccountDeletionResult> {
  const profile = await getProfile();
  if (!profile) return { error: "Not signed in" };

  const normalizedReason = normalizeDeletionReason(reason);
  if (normalizedReason != null && normalizedReason.length > MAX_DELETION_REASON_LENGTH) {
    return { error: `Reason must be at most ${MAX_DELETION_REASON_LENGTH} characters` };
  }

  const supabase = await createClient();
  const { data: row, error: fetchErr } = await supabase
    .from("profiles")
    .select("id, deleted_at, deletion_scheduled_for")
    .eq("id", profile.id)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!row?.id) return { error: "Profile not found" };

  if (row.deleted_at != null || row.deletion_scheduled_for != null) {
    return { success: true, alreadyScheduled: true };
  }

  const now = new Date();
  const deletionScheduledFor = addDays(now, 30);

  const { error } = await supabase
    .from("profiles")
    .update({
      deleted_at: now.toISOString(),
      deletion_scheduled_for: deletionScheduledFor.toISOString(),
      deletion_reason: normalizedReason,
      updated_at: now.toISOString(),
    })
    .eq("id", profile.id);

  if (error) return { error: error.message };

  revalidatePath("/frontier/pilots/portal");
  revalidatePath("/frontier/pilots/portal/profile");
  revalidatePath("/frontier/pilots/portal/settings", "layout");

  return { success: true };
}

export type CancelScheduledAccountDeletionResult =
  | { success: true }
  | { success: true; notScheduled: true }
  | { error: string };

/**
 * Clears scheduled soft-delete on the current user's profile (does not touch auth.users or sessions).
 * Idempotent: if nothing was scheduled, returns without updating.
 */
export async function cancelScheduledAccountDeletion(): Promise<CancelScheduledAccountDeletionResult> {
  const profile = await getProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { data: row, error: fetchErr } = await supabase
    .from("profiles")
    .select("id, deleted_at, deletion_scheduled_for")
    .eq("id", profile.id)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!row?.id) return { error: "Profile not found" };

  if (row.deleted_at == null && row.deletion_scheduled_for == null) {
    return { success: true, notScheduled: true };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      deleted_at: null,
      deletion_scheduled_for: null,
      deletion_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) return { error: error.message };

  revalidatePath("/frontier/pilots/portal");
  revalidatePath("/frontier/pilots/portal/profile");
  revalidatePath("/frontier/pilots/portal/settings", "layout");

  return { success: true };
}

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
  const dateOfHireRaw = ((formData.get("date_of_hire") as string) ?? "").trim();
  const dateOfHire = /^\d{4}-\d{2}-\d{2}$/.test(dateOfHireRaw)
    ? dateOfHireRaw
    : (profile.date_of_hire ?? null);
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
  const colorMode = (formData.get("color_mode") as string) || "dark";
  const mentorPhoneRaw = (formData.get("mentor_phone") as string)?.trim() ?? "";
  const mentorPhone = mentorPhoneRaw === "" ? null : formatUsPhoneDisplay(mentorPhoneRaw);
  const mentorContactEmail = (formData.get("mentor_contact_email") as string)?.trim() || null;

  const phoneFieldPresent = formData.has("phone");
  const profilePhoneRaw = (formData.get("phone") as string)?.trim() ?? "";
  const profilePhoneUpdate = phoneFieldPresent
    ? profilePhoneRaw === ""
      ? null
      : formatUsPhoneDisplay(profilePhoneRaw)
    : undefined;

  const personalEmailFieldPresent = formData.has("personal_email");
  const personalEmailRaw = (formData.get("personal_email") as string)?.trim() ?? "";
  const personalEmailUpdate = personalEmailFieldPresent
    ? personalEmailRaw === ""
      ? null
      : personalEmailRaw
    : undefined;

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
  if (!["dark", "light", "system"].includes(colorMode)) {
    return { error: "Invalid theme" };
  }
  if (mentorPhone && mentorPhone.length > 64) {
    return { error: "Mentor phone is too long" };
  }
  if (mentorContactEmail && mentorContactEmail.length > 254) {
    return { error: "Mentor contact email is too long" };
  }
  if (mentorContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mentorContactEmail)) {
    return { error: "Enter a valid mentor contact email" };
  }
  if (profilePhoneUpdate != null && profilePhoneUpdate.length > 64) {
    return { error: "Phone is too long" };
  }
  if (personalEmailUpdate != null && personalEmailUpdate.length > 254) {
    return { error: "Personal contact email is too long" };
  }
  if (personalEmailUpdate && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmailUpdate)) {
    return { error: "Enter a valid personal contact email" };
  }

  const supabase = await createClient();
  if (employeeNumber) {
    const takenRes = await isProfileEmployeeNumberTaken(supabase, {
      tenant: profile.tenant,
      portal: profile.portal,
      employeeNumberTrimmed: employeeNumber,
      excludeProfileId: profile.id,
    });
    if (takenRes.error) return { error: takenRes.error };
    if (takenRes.taken) return { error: PROFILE_EMPLOYEE_NUMBER_TAKEN_ERROR };
  }

  const updatePayload: Record<string, unknown> = {
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
    color_mode: colorMode,
    mentor_phone: mentorPhone,
    mentor_contact_email: mentorContactEmail,
    updated_at: new Date().toISOString(),
  };
  if (profilePhoneUpdate !== undefined) {
    updatePayload.phone = profilePhoneUpdate;
  }
  if (personalEmailUpdate !== undefined) {
    updatePayload.personal_email = personalEmailUpdate;
  }

  const { error } = await supabase.from("profiles").update(updatePayload).eq("id", profile.id);

  if (error) return { error: error.message };

  const cookieStore = await cookies();
  cookieStore.set("crewrules-color-mode", colorMode, { path: "/", maxAge: 60 * 60 * 24 * 365 });

  try {
    await ensureInboundAliasIfMissing(profile.id);
  } catch (err) {
    console.warn("[Profile] ensureInboundAliasIfMissing failed:", err);
  }

  revalidatePath("/frontier/pilots/portal");
  revalidatePath("/frontier/pilots/portal/profile");
  revalidatePath("/frontier/pilots/portal/settings", "layout");
  revalidatePath("/frontier/pilots/portal/schedule");
  revalidatePath("/frontier/pilots/portal/family-view");
  revalidatePath("/frontier/pilots/portal/mentoring");
  return { success: true };
}

export async function setColorMode(mode: "light" | "dark") {
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
    .update({ color_mode: mode, updated_at: new Date().toISOString() })
    .eq("id", profile.id);

  if (error) throw error;

  const cookieStore = await cookies();
  cookieStore.set("crewrules-color-mode", mode, { path: "/", maxAge: 60 * 60 * 24 * 365 });

  revalidatePath("/frontier/pilots/portal");
  return { ok: true };
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
  | { ok: false; reason: "trial_already_used" }
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

  if (profile.pro_trial_started_at != null) {
    return { ok: false, reason: "trial_already_used" };
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
  revalidatePath("/frontier/pilots/portal/settings", "layout");

  return { ok: true, pro_trial_expires_at: newExpiresAt };
}

export type MarkWelcomeModalSeenResult = { success: true } | { error: string };

export async function markWelcomeModalSeen(): Promise<MarkWelcomeModalSeenResult> {
  const profile = await getProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      welcome_modal_version_seen: CURRENT_WELCOME_MODAL_VERSION,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) return { error: error.message };

  revalidatePath("/frontier/pilots/portal");
  return { success: true };
}

export type BidReminderPrefsResult = { success: true } | { error: string };

const BID_REMINDER_SNOOZE_HOURS = 6;

/**
 * Snooze PBS bid reminder for six hours (Phase 1). No-op when outside the 24h pre-open window.
 */
export async function snoozeBidReminderSixHours(): Promise<BidReminderPrefsResult> {
  const profile = await getProfile();
  if (!profile) return { error: "Not signed in" };

  const now = new Date();
  const tz = profile.base_timezone?.trim() || PBS_BID_REMINDER_FALLBACK_TZ;
  const openingUtc = getApplicablePbsBidOpeningUtc(now, tz);
  if (!isInPbsBidReminderWindow(now, openingUtc)) {
    return { error: "Reminder is not active" };
  }

  const snoozedUntil = new Date(now.getTime() + BID_REMINDER_SNOOZE_HOURS * 60 * 60 * 1000).toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      bid_reminder_snoozed_until: snoozedUntil,
      updated_at: now.toISOString(),
    })
    .eq("id", profile.id);

  if (error) return { error: error.message };

  revalidatePath("/frontier/pilots/portal");
  return { success: true };
}

/**
 * Suppress PBS bid reminder for the current opening month (YYYY-MM). Only while the pre-open window is active.
 */
export async function suppressBidReminderForCurrentOpening(): Promise<BidReminderPrefsResult> {
  const profile = await getProfile();
  if (!profile) return { error: "Not signed in" };

  const now = new Date();
  const tz = profile.base_timezone?.trim() || PBS_BID_REMINDER_FALLBACK_TZ;
  const openingUtc = getApplicablePbsBidOpeningUtc(now, tz);
  if (!isInPbsBidReminderWindow(now, openingUtc)) {
    return { error: "Reminder is not active" };
  }

  const reminderMonth = getBidReminderMonthKey(openingUtc, tz);
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      bid_reminder_suppressed_month: reminderMonth,
      updated_at: now.toISOString(),
    })
    .eq("id", profile.id);

  if (error) return { error: error.message };

  revalidatePath("/frontier/pilots/portal");
  return { success: true };
}

// --- Family View invites (Phase 2 backend; raw token returned only from create for internal testing) ---

const FAMILY_VIEW_INVITE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOOSE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FamilyViewInviteListItem = {
  id: string;
  email: string;
  status: "pending" | "revoked";
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

export type CreateFamilyViewInviteResult =
  | {
      ok: true;
      invite: {
        id: string;
        email: string;
        status: "pending";
        expires_at: string;
        created_at: string;
        /** Raw secret for magic link; never stored in DB. */
        rawToken: string;
      };
      /** Set when invite was saved but the email send failed. Show as a non-blocking warning. */
      emailWarning?: string;
    }
  | { error: string };

export type ListFamilyViewInvitesResult =
  | { ok: true; invites: FamilyViewInviteListItem[] }
  | { error: string };

export type RevokeFamilyViewInviteResult =
  | { ok: true }
  | { ok: true; alreadyRevoked: true }
  | { error: string };

function revalidateFamilyViewInvitePaths() {
  revalidatePath("/frontier/pilots/portal/settings/family-view");
  revalidatePath("/frontier/pilots/portal/settings", "layout");
}

/**
 * Create or rotate a pending Family View invite for the given email (normalized).
 * If a pending invite already exists for this pilot + email, updates token_hash and extends expires_at.
 */
export async function createFamilyViewInvite(email: string): Promise<CreateFamilyViewInviteResult> {
  const profile = await getProfile();
  if (!profile) return { error: "Not signed in" };
  if (!profile.family_view_enabled) {
    return { error: "Turn on Family View in Sharing settings before creating invites." };
  }

  const normalized = normalizeFamilyViewInviteEmail(email);
  if (!normalized || !FAMILY_VIEW_INVITE_EMAIL_RE.test(normalized)) {
    return { error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data: pending, error: pendingErr } = await supabase
    .from("family_view_invites")
    .select("id")
    .eq("pilot_profile_id", profile.id)
    .eq("email", normalized)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingErr) return { error: pendingErr.message };

  if (!pending?.id) {
    const tier = profile.subscription_tier;
    const inviteLimit = tier === "pro" || tier === "enterprise" ? 5 : 1;
    const { count, error: countErr } = await supabase
      .from("family_view_invites")
      .select("*", { count: "exact", head: true })
      .eq("pilot_profile_id", profile.id)
      .eq("status", "pending")
      .gt("expires_at", nowIso);

    if (countErr) return { error: countErr.message };
    if ((count ?? 0) >= inviteLimit) {
      return { error: "You've reached your Family View limit." };
    }
  }

  const { rawToken, tokenHash } = generateFamilyViewInviteTokenPair();
  const expiresAt = addDays(new Date(), 30).toISOString();

  if (pending?.id) {
    const { data: updated, error: updErr } = await supabase
      .from("family_view_invites")
      .update({
        token_hash: tokenHash,
        expires_at: expiresAt,
        updated_at: nowIso,
      })
      .eq("id", pending.id)
      .eq("pilot_profile_id", profile.id)
      .eq("status", "pending")
      .select("id, email, status, expires_at, created_at")
      .single();

    if (updErr) return { error: updErr.message };
    if (!updated || updated.status !== "pending") return { error: "Could not update invite." };

    revalidateFamilyViewInvitePaths();
    const emailRes = await sendFamilyViewInviteEmail({
      to: updated.email,
      pilotFirstName: profile.full_name?.trim().split(/\s+/)[0] ?? "Your pilot",
      shareUrl: `https://www.crewrules.com/family-view/v/${rawToken}`,
    });
    return {
      ok: true,
      invite: {
        id: updated.id,
        email: updated.email,
        status: "pending",
        expires_at: updated.expires_at,
        created_at: updated.created_at,
        rawToken,
      },
      emailWarning: emailRes.ok ? undefined : "Invite saved — the email could not be sent.",
    };
  }

  const { data: inserted, error: insErr } = await supabase
    .from("family_view_invites")
    .insert({
      pilot_profile_id: profile.id,
      email: normalized,
      token_hash: tokenHash,
      status: "pending",
      expires_at: expiresAt,
      updated_at: nowIso,
    })
    .select("id, email, status, expires_at, created_at")
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      const { data: again } = await supabase
        .from("family_view_invites")
        .select("id")
        .eq("pilot_profile_id", profile.id)
        .eq("email", normalized)
        .eq("status", "pending")
        .maybeSingle();

      if (again?.id) {
        const { data: updated, error: updErr2 } = await supabase
          .from("family_view_invites")
          .update({
            token_hash: tokenHash,
            expires_at: expiresAt,
            updated_at: nowIso,
          })
          .eq("id", again.id)
          .eq("pilot_profile_id", profile.id)
          .eq("status", "pending")
          .select("id, email, status, expires_at, created_at")
          .single();

        if (updErr2) return { error: updErr2.message };
        if (!updated || updated.status !== "pending") return { error: "Could not update invite after conflict." };

        revalidateFamilyViewInvitePaths();
        const emailRes2 = await sendFamilyViewInviteEmail({
          to: updated.email,
          pilotFirstName: profile.full_name?.trim().split(/\s+/)[0] ?? "Your pilot",
          shareUrl: `https://www.crewrules.com/family-view/v/${rawToken}`,
        });
        return {
          ok: true,
          invite: {
            id: updated.id,
            email: updated.email,
            status: "pending",
            expires_at: updated.expires_at,
            created_at: updated.created_at,
            rawToken,
          },
          emailWarning: emailRes2.ok ? undefined : "Invite saved — the email could not be sent.",
        };
      }
    }
    return { error: insErr.message };
  }

  if (!inserted || inserted.status !== "pending") return { error: "Could not create invite." };

  revalidateFamilyViewInvitePaths();
  const emailRes3 = await sendFamilyViewInviteEmail({
    to: inserted.email,
    pilotFirstName: profile.full_name?.trim().split(/\s+/)[0] ?? "Your pilot",
    shareUrl: `https://www.crewrules.com/family-view/v/${rawToken}`,
  });
  return {
    ok: true,
    invite: {
      id: inserted.id,
      email: inserted.email,
      status: "pending",
      expires_at: inserted.expires_at,
      created_at: inserted.created_at,
      rawToken,
    },
    emailWarning: emailRes3.ok ? undefined : "Invite saved — the email could not be sent.",
  };
}

export async function listFamilyViewInvites(): Promise<ListFamilyViewInvitesResult> {
  const profile = await getProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("family_view_invites")
    .select("id, email, status, expires_at, revoked_at, created_at")
    .eq("pilot_profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  const invites = (data ?? []) as FamilyViewInviteListItem[];
  return { ok: true, invites };
}

export async function revokeFamilyViewInvite(inviteId: string): Promise<RevokeFamilyViewInviteResult> {
  const profile = await getProfile();
  if (!profile) return { error: "Not signed in" };

  const id = inviteId.trim();
  if (!id || !LOOSE_UUID_RE.test(id)) return { error: "Invalid invite id." };

  const supabase = await createClient();

  const { data: row, error: fetchErr } = await supabase
    .from("family_view_invites")
    .select("id, status")
    .eq("id", id)
    .eq("pilot_profile_id", profile.id)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!row) return { error: "Invite not found." };
  if (row.status === "revoked") {
    revalidateFamilyViewInvitePaths();
    return { ok: true, alreadyRevoked: true };
  }

  const nowIso = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("family_view_invites")
    .update({
      status: "revoked",
      revoked_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", id)
    .eq("pilot_profile_id", profile.id)
    .eq("status", "pending");

  if (updErr) return { error: updErr.message };

  revalidateFamilyViewInvitePaths();
  return { ok: true };
}
