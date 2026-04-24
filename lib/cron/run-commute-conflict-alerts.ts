import { formatInTimeZone } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchFlightsFromAerodataBox } from "@/lib/aerodatabox";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { getScheduleEventDutyStartMs } from "@/lib/leg-dates";
import { sendCommuteConflictAlert } from "@/lib/email/send-commute-conflict-alert";

const FLICA_SOURCE = "flica_import";
const USER_BATCH_LIMIT = 50;
const UPCOMING_EVENT_SCAN = 15;

export type CommuteConflictAlertsResult = {
  ok: true;
  enabled: true;
  message: string;
  scannedUsers: number;
  /** Deliveries to intended pilot inbox (personal_email if set, else email; requires COMMUTE_CONFLICT_EMAILS_ENABLED=true and COMMUTE_CONFLICT_EMAIL_DRY_RUN≠true). */
  emailsSent: number;
  /** Preview deliveries to COMMUTE_CONFLICT_EMAIL_TEST_RECIPIENT when real sends are off or dry-run is on. */
  dryRunEmailsSent?: number;
  skippedNoDuty?: number;
  skippedNoFlights?: number;
  skippedNotUnsafe?: number;
  skippedDeduped?: number;
  /** Previews that continued despite matching last_commute_alert_trip_id (COMMUTE_CONFLICT_EMAIL_DRY_RUN only). */
  dryRunBypassedDeduped?: number;
  /** Alert would have fired but no delivery path (real off/dry-run and no test recipient). */
  skippedNoEmailRoute?: number;
  /** Profiles excluded because COMMUTE_CONFLICT_EMAIL_TEST_USER_ID was set to another id (no schedule/ADB work for those rows). */
  skippedByTestUserFilter?: number;
  errors: number;
};

type ScheduleRow = {
  start_time: string;
  end_time: string;
  title: string | null;
  event_type: string;
  report_time?: string | null;
};

function isVacationCode(title: string | null | undefined): boolean {
  const t = (title ?? "").trim().toUpperCase();
  return /^V\d+$/.test(t);
}

function tripIdFor(userId: string, startTimeIso: string): string {
  return `${userId}_${startTimeIso}`;
}

function isNoSafeSameDay(flights: { arrivalTime: string }[], arriveByMs: number): boolean {
  if (flights.length === 0) return false;
  return flights.every((f) => {
    const arrMs = new Date(f.arrivalTime).getTime();
    if (Number.isNaN(arrMs)) return false;
    return arrMs > arriveByMs;
  });
}

type CommuteAlertRecipientSource = "personal_email" | "email";

function intendedCommuteAlertRecipient(personalEmailRaw: unknown, loginEmailRaw: unknown): {
  address: string;
  recipientSource: CommuteAlertRecipientSource;
} | null {
  const personal = String(personalEmailRaw ?? "").trim();
  if (personal.length > 0) {
    return { address: personal, recipientSource: "personal_email" };
  }
  const login = String(loginEmailRaw ?? "").trim();
  if (login.length > 0) {
    return { address: login, recipientSource: "email" };
  }
  return null;
}

/**
 * Daily cron: Pro users with home/base, next FLICA duty, ADB home→base flights;
 * email when at least one flight exists and every option lands after arrive-by (report − buffer).
 */
function commuteConflictEmailEnv() {
  const emailsEnabled = process.env.COMMUTE_CONFLICT_EMAILS_ENABLED === "true";
  const dryRun = process.env.COMMUTE_CONFLICT_EMAIL_DRY_RUN === "true";
  const testRecipient = process.env.COMMUTE_CONFLICT_EMAIL_TEST_RECIPIENT?.trim() ?? "";
  const sendToRealUsers = emailsEnabled && !dryRun;
  return { emailsEnabled, dryRun, testRecipient, sendToRealUsers };
}

export async function runCommuteConflictAlerts(): Promise<CommuteConflictAlertsResult> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const emailEnv = commuteConflictEmailEnv();
  const testUserIdRaw = process.env.COMMUTE_CONFLICT_EMAIL_TEST_USER_ID?.trim() ?? "";
  const testUserIdFilter = testUserIdRaw.length > 0 ? testUserIdRaw : null;

  let emailsSent = 0;
  let dryRunEmailsSent = 0;
  let skippedNoDuty = 0;
  let skippedNoFlights = 0;
  let skippedNotUnsafe = 0;
  let skippedDeduped = 0;
  let dryRunBypassedDeduped = 0;
  let skippedNoEmailRoute = 0;
  let skippedByTestUserFilter = 0;
  let errors = 0;

  console.log("[commute-conflict-alerts] email env", {
    COMMUTE_CONFLICT_EMAILS_ENABLED: emailEnv.emailsEnabled,
    COMMUTE_CONFLICT_EMAIL_DRY_RUN: emailEnv.dryRun,
    has_COMMUTE_CONFLICT_EMAIL_TEST_RECIPIENT: Boolean(emailEnv.testRecipient),
    has_COMMUTE_CONFLICT_EMAIL_TEST_USER_ID: Boolean(testUserIdFilter),
    sendToRealUsers: emailEnv.sendToRealUsers,
    dryRunDedupeBypassForPreviews: emailEnv.dryRun,
  });
  if (emailEnv.sendToRealUsers) {
    console.log("[commute-conflict-alerts] real send path: enabled (pilot inbox)");
  } else {
    console.log(
      "[commute-conflict-alerts] real send path: disabled — pilots will not receive email unless COMMUTE_CONFLICT_EMAILS_ENABLED=true and COMMUTE_CONFLICT_EMAIL_DRY_RUN is not true"
    );
  }

  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select(
      "id, email, personal_email, full_name, home_airport, base_airport, base_timezone, subscription_tier, pro_trial_expires_at, commute_arrival_buffer_minutes, last_commute_alert_trip_id"
    )
    .not("email", "is", null)
    .not("home_airport", "is", null)
    .not("base_airport", "is", null)
    .is("deleted_at", null)
    .or(
      `subscription_tier.eq.pro,subscription_tier.eq.enterprise,pro_trial_expires_at.gt.${nowIso}`
    )
    .limit(USER_BATCH_LIMIT);

  if (profErr) {
    console.error("[commute-conflict-alerts] profiles query", profErr.message);
    return {
      ok: true,
      enabled: true,
      message: `Aborted: ${profErr.message}`,
      scannedUsers: 0,
      emailsSent: 0,
      skippedByTestUserFilter: 0,
      errors: 1,
    };
  }

  const users = profiles ?? [];
  if (testUserIdFilter) {
    console.log("[commute-conflict-alerts] single-user test mode active (COMMUTE_CONFLICT_EMAIL_TEST_USER_ID)");
  }
  console.log("[commute-conflict-alerts] start", { scannedUsers: users.length, limit: USER_BATCH_LIMIT });

  for (const row of users) {
    const userId = row.id as string;
    if (testUserIdFilter && userId !== testUserIdFilter) {
      skippedByTestUserFilter++;
      continue;
    }
    const intended = intendedCommuteAlertRecipient(row.personal_email, row.email);
    const home = String(row.home_airport ?? "")
      .trim()
      .toUpperCase();
    const base = String(row.base_airport ?? "")
      .trim()
      .toUpperCase();
    const baseTz =
      (row.base_timezone as string | null)?.trim() ||
      (base.length === 3 ? getTimezoneFromAirport(base) : "America/Denver");
    const arrivalBuffer = Math.max(0, (row.commute_arrival_buffer_minutes as number | null) ?? 60);
    const lastTrip = (row.last_commute_alert_trip_id as string | null) ?? null;

    if (!intended || home.length !== 3 || base.length !== 3) {
      continue;
    }

    try {
      const { data: upcoming, error: evErr } = await admin
        .from("schedule_events")
        .select("start_time, end_time, title, event_type, report_time")
        .eq("user_id", userId)
        .eq("source", FLICA_SOURCE)
        .or("is_muted.eq.false,is_muted.is.null")
        .gt("start_time", nowIso)
        .order("start_time", { ascending: true })
        .limit(UPCOMING_EVENT_SCAN);

      if (evErr) {
        console.error("[commute-conflict-alerts] schedule_events", { userId, message: evErr.message });
        errors++;
        continue;
      }

      const nextEvent = (upcoming as ScheduleRow[] | null)?.find((e) => !isVacationCode(e.title)) ?? null;
      if (!nextEvent) {
        skippedNoDuty++;
        continue;
      }

      const dutyStartMs = getScheduleEventDutyStartMs(nextEvent, baseTz);
      if (Number.isNaN(dutyStartMs)) {
        skippedNoDuty++;
        continue;
      }

      const arriveByMs = dutyStartMs - arrivalBuffer * 60 * 1000;
      const dutyDateStr = formatInTimeZone(new Date(dutyStartMs), baseTz, "yyyy-MM-dd");

      const tripKey = tripIdFor(userId, nextEvent.start_time);
      if (tripKey === lastTrip) {
        if (emailEnv.dryRun) {
          dryRunBypassedDeduped++;
          console.log("[commute-conflict-alerts] dryRunBypassedDeduped: continuing preview (skipped real dedupe)", {
            userId,
            tripKey,
            dryRunBypassedDeduped,
          });
        } else {
          skippedDeduped++;
          continue;
        }
      }

      const { flights } = await fetchFlightsFromAerodataBox(home, base, dutyDateStr);
      if (flights.length === 0) {
        skippedNoFlights++;
        continue;
      }

      if (!isNoSafeSameDay(flights, arriveByMs)) {
        skippedNotUnsafe++;
        continue;
      }

      const fullName = (row.full_name as string | null) ?? null;

      if (emailEnv.sendToRealUsers) {
        console.log("[commute-conflict-alerts] real send: delivering to pilot", {
          userId,
          tripKey,
          recipientSource: intended.recipientSource,
        });
        const send = await sendCommuteConflictAlert({
          to: intended.address,
          fullName,
          flights,
          dutyStartMs,
          baseTz,
        });

        if (!send.ok) {
          console.error("[commute-conflict-alerts] send failed", { userId, error: send.error });
          errors++;
          continue;
        }

        const { error: upErr } = await admin
          .from("profiles")
          .update({ last_commute_alert_trip_id: tripKey })
          .eq("id", userId);

        if (upErr) {
          console.error("[commute-conflict-alerts] profile update", { userId, message: upErr.message });
          errors++;
          continue;
        }

        emailsSent++;
        console.log("[commute-conflict-alerts] sent (real)", {
          userId,
          tripKey,
          dutyDateStr,
          flightCount: flights.length,
        });
      } else if (emailEnv.testRecipient) {
        console.log("[commute-conflict-alerts] dry-run: sending preview to test recipient", {
          userId,
          tripKey,
          recipientSource: intended.recipientSource,
        });
        const send = await sendCommuteConflictAlert({
          to: emailEnv.testRecipient,
          fullName,
          flights,
          dutyStartMs,
          baseTz,
          dryRun: true,
          originalRecipientEmail: intended.address,
        });

        if (!send.ok) {
          console.error("[commute-conflict-alerts] dry-run send failed", { userId, error: send.error });
          errors++;
          continue;
        }

        dryRunEmailsSent++;
        console.log("[commute-conflict-alerts] sent (dry-run preview)", {
          userId,
          tripKey,
          dutyDateStr,
          flightCount: flights.length,
        });
      } else {
        skippedNoEmailRoute++;
        console.log("[commute-conflict-alerts] skipped send: no delivery route", {
          userId,
          tripKey,
          reason:
            "Real sends off or dry-run active, and COMMUTE_CONFLICT_EMAIL_TEST_RECIPIENT is not set — no email sent",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[commute-conflict-alerts] row error", { userId, msg });
      errors++;
    }
  }

  const message = `Processed ${users.length} users; emailsSent(real)=${emailsSent}; dryRunEmailsSent=${dryRunEmailsSent}; dryRunBypassedDeduped=${dryRunBypassedDeduped}; skippedByTestUserFilter=${skippedByTestUserFilter}`;
  console.log("[commute-conflict-alerts] end", {
    scannedUsers: users.length,
    emailsSent,
    dryRunEmailsSent,
    dryRunBypassedDeduped,
    skippedNoDuty,
    skippedNoFlights,
    skippedNotUnsafe,
    skippedDeduped,
    skippedNoEmailRoute,
    skippedByTestUserFilter,
    errors,
  });

  return {
    ok: true,
    enabled: true,
    message,
    scannedUsers: users.length,
    emailsSent,
    dryRunEmailsSent,
    dryRunBypassedDeduped,
    skippedNoDuty,
    skippedNoFlights,
    skippedNotUnsafe,
    skippedDeduped,
    skippedNoEmailRoute,
    skippedByTestUserFilter,
    errors,
  };
}
