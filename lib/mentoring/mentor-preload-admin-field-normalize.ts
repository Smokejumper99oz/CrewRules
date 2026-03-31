/**
 * Normalization for tenant-admin manual edits to mentor_preload (matches CSV import rules).
 */

const ALLOWED_POSITIONS = new Set(["captain", "first_officer", "flight_attendant"]);

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

export function normalizeMentorPreloadPositionForAdmin(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (!s) return null;
  if (ALLOWED_POSITIONS.has(s)) return s;
  return null;
}

export function normalizeMentorPreloadBaseAirportForAdmin(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  if (!s) return null;
  if (!/^[A-Z]{3}$/.test(s)) return null;
  return s;
}
