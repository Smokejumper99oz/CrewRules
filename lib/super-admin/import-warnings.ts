import { formatDisplayName } from "@/lib/format-display-name";

export type ImportWarningRow = {
  id: string;
  atIso: string;
  userLabel: string;
  userEmail: string | null;
  reason: string;
};

/** Shape matches enriched recent import rows from `schedule_events` aggregation. */
export type ImportBatchForWarnings = {
  user_id: string;
  imported_at: string;
  count: number;
  import_batch_id: string | null;
  user_email: string | null;
  user_full_name: string | null;
};

/** Within this window, multiple imports by the same user trigger a warning. */
const RAPID_REPEAT_MS = 30 * 60 * 1000;

/** Event count at or above this in one batch is flagged as unusually high. */
const HIGH_EVENT_COUNT_THRESHOLD = 80;

function importWarningUserLabel(imp: ImportBatchForWarnings): string {
  const n = formatDisplayName(imp.user_full_name);
  if (n) return n;
  const e = imp.user_email?.trim();
  if (e) return e;
  return `${imp.user_id.replace(/-/g, "").slice(0, 8)}…`;
}

/**
 * Heuristics over enriched recent import batches (same window as dashboard import activity).
 * UI-only signal; does not change import behavior.
 */
export function buildImportWarningRows(imports: ImportBatchForWarnings[]): ImportWarningRow[] {
  const rows: ImportWarningRow[] = [];
  const batchKey = (i: ImportBatchForWarnings) => `${i.user_id}-${i.imported_at}`;

  for (const imp of imports) {
    const key = batchKey(imp);
    const t = new Date(imp.imported_at).getTime();

    const sameUserOtherBatch = imports.some((o) => {
      if (o.user_id !== imp.user_id) return false;
      if (batchKey(o) === key) return false;
      const dt = Math.abs(new Date(o.imported_at).getTime() - t);
      return dt > 0 && dt <= RAPID_REPEAT_MS;
    });
    const emailForRow = imp.user_email?.trim() || null;

    if (sameUserOtherBatch) {
      rows.push({
        id: `${key}-rapid`,
        atIso: imp.imported_at,
        userLabel: importWarningUserLabel(imp),
        userEmail: emailForRow,
        reason: "Multiple imports within 30 minutes",
      });
    }

    if (imp.count >= HIGH_EVENT_COUNT_THRESHOLD) {
      rows.push({
        id: `${key}-highcount`,
        atIso: imp.imported_at,
        userLabel: importWarningUserLabel(imp),
        userEmail: emailForRow,
        reason: `Unusually high event count (${imp.count})`,
      });
    }

    if (!imp.import_batch_id?.trim()) {
      rows.push({
        id: `${key}-nobatch`,
        atIso: imp.imported_at,
        userLabel: importWarningUserLabel(imp),
        userEmail: emailForRow,
        reason: "Missing import batch ID",
      });
    }

    if (!imp.user_full_name?.trim() && !imp.user_email?.trim()) {
      rows.push({
        id: `${key}-nouser`,
        atIso: imp.imported_at,
        userLabel: importWarningUserLabel(imp),
        userEmail: emailForRow,
        reason: "Missing user display info (no profile name or email)",
      });
    }
  }

  rows.sort((a, b) => new Date(b.atIso).getTime() - new Date(a.atIso).getTime());
  return rows;
}
