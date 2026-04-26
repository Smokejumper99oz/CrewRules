import { Resend } from "resend";
import { enUS } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { buildCrewrulesTransactionalEmailHtml } from "@/lib/email/crewrules-transactional-email-html";
import type { CommuteFlight } from "@/lib/aviationstack";

const resend = new Resend(process.env.RESEND_API_KEY);

const MAX_COMMUTE_PREVIEW_FLIGHTS = 3;

/** Email display only — IATA / common code → marketing name for commute preview lines. */
const AIRLINE_CODE_TO_DISPLAY_NAME: Record<string, string> = {
  F9: "Frontier",
  B6: "JetBlue",
  WN: "Southwest",
  UA: "United",
  AA: "American",
  DL: "Delta",
  NK: "Spirit",
  AS: "Alaska",
};

function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type SendParams = {
  to: string;
  fullName: string | null;
  /** Flights already loaded during commute conflict detection (same ADB result; no extra fetches). */
  flights: CommuteFlight[];
  /** Duty report instant (ms); same anchor as `dutyDateStr` / `arriveByMs` in cron. */
  dutyStartMs: number;
  /** Crew base IANA timezone (same as used for `dutyDateStr`). */
  baseTz: string;
  /** When true, `to` must be the test inbox; original pilot address is shown in subject/body only. */
  dryRun?: boolean;
  /** Pilot email when `dryRun` is true (for labeling only). */
  originalRecipientEmail?: string;
};

const SUBJECT_REAL =
  "⚠️ CrewRules™ Commute Assist™ Alert: No Safe Same-Day Commute Found";

function buildSubjectDryRun(originalRecipientEmail: string): string {
  return `[DRY RUN - original recipient: ${originalRecipientEmail.trim()}] ⚠️ CrewRules™ Commute Assist™ Alert`;
}

function buildReportDateTimeSectionHtml(dutyStartMs: number, baseTz: string): string {
  const tz = (baseTz ?? "").trim() || "UTC";
  const d = new Date(dutyStartMs);
  if (Number.isNaN(d.getTime())) {
    return `<p style="margin:0 0 16px 0;color:#111827;line-height:1.6;"><strong>Report Date/Time:</strong><br />—</p>`;
  }
  try {
    const formatted = formatInTimeZone(d, tz, "EEEE, MMMM d, yyyy 'at' HH:mm", { locale: enUS });
    return `<p style="margin:0 0 16px 0;color:#111827;line-height:1.6;"><strong>Report Date/Time:</strong><br />${escapeHtml(formatted)} base time</p>`;
  } catch {
    return `<p style="margin:0 0 16px 0;color:#111827;line-height:1.6;"><strong>Report Date/Time:</strong><br />—</p>`;
  }
}

function formatLocalHm(iso: string, tz: string | undefined): string {
  const zone = (tz ?? "").trim() || "UTC";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return formatInTimeZone(d, zone, "HH:mm");
  } catch {
    return "—";
  }
}

function parseCarrierFromFlightNumber(flightNumberRaw: string | undefined): string {
  const compact = (flightNumberRaw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const m = compact.match(/^([A-Z]{2})\d/);
  return m ? m[1] : "";
}

function iataCarrierCode(f: CommuteFlight): string {
  const fromField = (f.carrier ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2);
  if (fromField.length === 2) return fromField;
  return parseCarrierFromFlightNumber(f.flightNumber);
}

function extractFlightNumericOnly(flightNumberRaw: string | undefined, carrierCode: string): string {
  let s = (flightNumberRaw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const code = (carrierCode ?? "").trim().toUpperCase();
  if (code.length === 2 && s.startsWith(code)) {
    s = s.slice(2);
  }
  const digits = s.replace(/\D/g, "");
  return digits || "—";
}

/** e.g. "Frontier 2216" or "XY 415" when code is unknown (code once, no duplicate). */
function flightPreviewLineLabel(f: CommuteFlight): string {
  const code = iataCarrierCode(f);
  const num = extractFlightNumericOnly(f.flightNumber, code);
  const name = code ? AIRLINE_CODE_TO_DISPLAY_NAME[code] : undefined;
  if (name) return `${name} FLT ${num}`;
  if (code) return `${code} FLT ${num}`;
  return `FLT ${num}`;
}

function buildCommuteFlightsPreviewHtml(flights: CommuteFlight[]): string {
  const sorted = [...flights].sort(
    (a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime()
  );
  const top = sorted.slice(0, MAX_COMMUTE_PREVIEW_FLIGHTS);

  const heading = `<p style="margin:0 0 8px 0;"><strong>Same-day flights reviewed:</strong></p>`;

  if (top.length === 0) {
    return `${heading}
<p style="margin:0 0 16px 0;color:#374151;">No viable same-day options found based on current data.</p>`;
  }

  const reviewedNote = `<p style="margin:0 0 12px 0;color:#374151;font-size:15px;line-height:1.55;">These flights were reviewed, but they arrive too late or do not meet your saved commute buffer.</p>`;

  const items = top
    .map((f) => {
      const label = escapeHtml(flightPreviewLineLabel(f));
      const dep = escapeHtml(formatLocalHm(f.departureTime, f.origin_tz));
      const arr = escapeHtml(formatLocalHm(f.arrivalTime, f.dest_tz));
      return `<li style="margin:0 0 8px 0;">${label} · Depart ${dep} local · Arrive ${arr} local</li>`;
    })
    .join("");

  return `${heading}
${reviewedNote}
<ul style="margin:0 0 16px 0;padding-left:20px;color:#374151;">
${items}
</ul>`;
}

/**
 * Server-only. Resend email when no same-day commute options arrive by report minus buffer.
 */
export async function sendCommuteConflictAlert(
  params: SendParams
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { to, fullName, flights, dutyStartMs, baseTz, dryRun, originalRecipientEmail } = params;

  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const greeting = fullName?.trim()
    ? `Hi ${escapeHtml(fullName.trim())},`
    : "Hi,";

  const dryRunBanner =
    dryRun === true && originalRecipientEmail?.trim()
      ? `<div style="margin:0 0 20px 0;padding:14px 16px;background:#fffbeb;border:1px solid #f59e0b;border-radius:12px;font-size:14px;color:#92400e;line-height:1.5;">
  <strong style="display:block;margin-bottom:6px;color:#78350f;">Dry run</strong>
  <span style="color:#92400e;">Intended recipient (not used for delivery): ${escapeHtml(originalRecipientEmail.trim())}</span>
</div>`
      : "";

  const flightsSection = buildCommuteFlightsPreviewHtml(flights);
  const reportSection = buildReportDateTimeSectionHtml(dutyStartMs, baseTz);

  const bodyInnerHtml = `${dryRunBanner}
${reportSection}
<p style="margin:0 0 16px 0;">${greeting}</p>
<p style="margin:0 0 16px 0;">CrewRules™ checked your upcoming duty and could not find a safe same-day commute option based on your saved commute settings.</p>
${flightsSection}
<p style="margin:0 0 16px 0;"><strong>Recommended Action:</strong> Plan to commute the day before.</p>
<p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">This is an automated CrewRules™ Commute Alert. Please verify options before making travel decisions.</p>`;

  const html = buildCrewrulesTransactionalEmailHtml(bodyInnerHtml);

  const subject =
    dryRun === true && originalRecipientEmail?.trim()
      ? buildSubjectDryRun(originalRecipientEmail.trim())
      : SUBJECT_REAL;

  const { error } = await resend.emails.send({
    from: "CrewRules™ <support@contact.crewrules.com>",
    to,
    subject,
    html,
  });

  if (error) {
    console.error("[commute-conflict-alert] resend error", { dryRun: dryRun === true, error });
    return { ok: false, error: error.message ?? "Resend error" };
  }

  return { ok: true };
}
