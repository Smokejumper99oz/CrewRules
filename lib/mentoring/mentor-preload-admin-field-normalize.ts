/**
 * Normalization for tenant-admin manual edits to mentor_preload (matches CSV import rules).
 */

const ALLOWED_POSITIONS = new Set(["captain", "first_officer", "flight_attendant"]);

/** Uppercase, punctuation-stripped, no spaces — spreadsheet-style role tokens. */
const CAPTAIN_COMPACT_ALIASES = new Set(["CA", "CPT", "CAPT", "CAPTAIN"]);
const FIRST_OFFICER_COMPACT_ALIASES = new Set(["FO", "FIRSTOFFICER"]);
const FLIGHT_ATTENDANT_COMPACT_ALIASES = new Set(["FA", "FLIGHTATTENDANT"]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeMentorPreloadWorkEmailForAdmin(
  raw: string
): { ok: true; email: string | null } | { ok: false; error: string } {
  const s = raw.trim();
  if (!s) return { ok: true, email: null };
  const lower = s.toLowerCase();
  if (!EMAIL_RE.test(lower)) {
    return { ok: false, error: "Invalid work email." };
  }
  return { ok: true, email: lower };
}

export function normalizeMentorPreloadPersonalEmailForAdmin(
  raw: string
): { ok: true; email: string | null } | { ok: false; error: string } {
  const s = raw.trim();
  if (!s) return { ok: true, email: null };
  const lower = s.toLowerCase();
  if (!EMAIL_RE.test(lower)) {
    return { ok: false, error: "Invalid personal email." };
  }
  return { ok: true, email: lower };
}

function mentorPreloadPositionCompact(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[.\/'’\-]/g, "")
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

/**
 * Maps mentor preload / CSV role text to DB `position` enum values.
 * Accepts canonical snake_case, human-readable titles, and common abbreviations (CA, FO, FA, F/O, F/A, etc.).
 */
export function normalizeMentorPreloadPositionForAdmin(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  const snake = t.toLowerCase().replace(/\s+/g, "_");
  if (ALLOWED_POSITIONS.has(snake)) return snake;

  const compact = mentorPreloadPositionCompact(t);
  if (!compact) return null;
  if (CAPTAIN_COMPACT_ALIASES.has(compact)) return "captain";
  if (FIRST_OFFICER_COMPACT_ALIASES.has(compact)) return "first_officer";
  if (FLIGHT_ATTENDANT_COMPACT_ALIASES.has(compact)) return "flight_attendant";

  return null;
}

export function normalizeMentorPreloadBaseAirportForAdmin(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  if (!s) return null;
  if (!/^[A-Z]{3}$/.test(s)) return null;
  return s;
}
