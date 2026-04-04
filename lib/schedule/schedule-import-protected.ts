import type { SupabaseClient } from "@supabase/supabase-js";

/** Reserve codes: RSA, RSB, RSC, RSD, RSE, RSL. */
const RESERVE_CODE = /\b(RSA|RSB|RSC|RSD|RSE|RSL)\b/i;

/** True if title indicates a trip assigned from reserve (e.g. "RSA Trip S3019"). */
export function isReserveAssignmentByTitle(title: string): boolean {
  return RESERVE_CODE.test(title ?? "") && (/\bTrip\b/i.test(title ?? "") || /\bS\d{4}\b/i.test(title ?? ""));
}

/**
 * Heuristic FLICA-style classification (after DB exact-match misses).
 * Does not consult DB; keep patterns conservative so S3120 / RSA stay trips/reserve.
 */
export function inferScheduleEventTypeHeuristic(summary: string): ScheduleImportEventType {
  const s = summary ?? "";
  if (/\bVAC\b|Vacation|\bV\d+\b/i.test(s)) return "vacation";
  if (/\bOFF\b|\bOff\b|Off Duty|DAY OFF/i.test(s)) return "off";
  if (/\bPAY\b/i.test(s)) return "pay";
  if (/\bSICK\b/i.test(s)) return "sick";
  if (isReserveAssignmentByTitle(s)) return "trip";
  if (/\b(RES|RSA|RSB|RSC|RSD|RDE|RSE|RSL)\b|Reserve/i.test(s)) return "reserve";
  return "trip";
}

/** Event types allowed on schedule_events + import inference (matches DB check). */
export type ScheduleImportEventType =
  | "trip"
  | "reserve"
  | "vacation"
  | "off"
  | "other"
  | "pay"
  | "sick"
  | "training";

export function normalizeScheduleImportTitle(title: string | null | undefined): string {
  return (title ?? "").trim().toUpperCase();
}

export type LoadedScheduleImportProtectedCodes = {
  /** normalized_code -> event_type (tenant rows override global tenant-null rows). */
  classification: Map<string, ScheduleImportEventType>;
  /** normalized titles to keep on baseline replace */
  preservationNormalizedTitles: Set<string>;
};

const ALLOWED: ReadonlySet<string> = new Set([
  "trip",
  "reserve",
  "vacation",
  "off",
  "other",
  "pay",
  "sick",
  "training",
]);

function coerceEventType(raw: string): ScheduleImportEventType | null {
  const t = raw?.trim().toLowerCase();
  if (!t || !ALLOWED.has(t)) return null;
  return t as ScheduleImportEventType;
}

/**
 * Load active protected codes for import: tenant-specific rows override global (tenant is null).
 */
export async function loadScheduleImportProtectedCodes(
  supabase: SupabaseClient,
  tenant: string
): Promise<LoadedScheduleImportProtectedCodes> {
  const { data, error } = await supabase
    .from("schedule_import_protected_codes")
    .select("tenant, normalized_code, event_type, preserve_on_baseline_replace")
    .eq("active", true);

  if (error || !data?.length) {
    return {
      classification: new Map(),
      preservationNormalizedTitles: new Set(),
    };
  }

  type Row = {
    tenant: string | null;
    normalized_code: string;
    event_type: string;
    preserve_on_baseline_replace: boolean;
  };

  const rows = (data as Row[]).filter((r) => r.tenant == null || r.tenant === tenant);
  if (rows.length === 0) {
    return {
      classification: new Map(),
      preservationNormalizedTitles: new Set(),
    };
  }
  const globalRows = rows.filter((r) => r.tenant == null);
  const tenantRows = rows.filter((r) => r.tenant === tenant);

  const classification = new Map<string, ScheduleImportEventType>();
  for (const r of globalRows) {
    const et = coerceEventType(r.event_type);
    if (et && r.normalized_code) classification.set(r.normalized_code, et);
  }
  for (const r of tenantRows) {
    const et = coerceEventType(r.event_type);
    if (et && r.normalized_code) classification.set(r.normalized_code, et);
  }

  const preservationNormalizedTitles = new Set<string>();
  for (const r of rows) {
    if (!r.preserve_on_baseline_replace || !r.normalized_code) continue;
    if (r.tenant != null && r.tenant !== tenant) continue;
    preservationNormalizedTitles.add(r.normalized_code);
  }

  return { classification, preservationNormalizedTitles };
}

/**
 * Exact match on normalized SUMMARY to DB code; otherwise heuristic infer.
 */
export function resolveScheduleEventType(
  summary: string,
  classification: Map<string, ScheduleImportEventType>,
  inferEventType: (s: string) => ScheduleImportEventType
): ScheduleImportEventType {
  const key = normalizeScheduleImportTitle(summary);
  const fromDb = key.length > 0 ? classification.get(key) : undefined;
  if (fromDb) return fromDb;
  return inferEventType(summary);
}
