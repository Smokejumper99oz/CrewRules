/**
 * Frontier mentoring CSV: final template headers and parsing (server-side).
 */

export const FRONTIER_MENTORING_CSV_HEADERS = [
  "mentor_employee_number",
  "hire_date",
  "mentee_full_name",
  "mentee_employee_number",
  "mentee_phone",
  "mentee_email@private",
  "mentee_email@flyfrontier.com",
  "notes",
] as const;

export type FrontierMentoringCsvHeader = (typeof FRONTIER_MENTORING_CSV_HEADERS)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      result.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

export function isValidHireDateYyyyMmDd(value: string): boolean {
  const t = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
  const d = Date.parse(`${t}T12:00:00.000Z`);
  return !Number.isNaN(d);
}

function isValidCalendarUtcYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Trim; accept YYYY-MM-DD or US M/D/YYYY (month first); return ISO date or null. */
export function normalizeHireDate(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return isValidHireDateYyyyMmDd(t) ? t : null;
  }
  const mdY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (!mdY) return null;
  const m = Number(mdY[1]);
  const d = Number(mdY[2]);
  const y = Number(mdY[3]);
  if (!isValidCalendarUtcYmd(y, m, d)) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Empty / whitespace-only → null. Local part only → lower + @flyfrontier.com. */
export function normalizeMenteeCompanyEmail(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (!lower.includes("@")) return `${lower}@flyfrontier.com`;
  return lower;
}

/** Optional personal email: empty → null; invalid syntax → invalid. */
export function normalizeOptionalPersonalEmail(
  raw: string
): { ok: true; email: string | null } | { ok: false; error: string } {
  const s = raw.trim();
  if (!s) return { ok: true, email: null };
  const lower = s.toLowerCase();
  if (!EMAIL_RE.test(lower)) return { ok: false, error: "Invalid mentee_email@private" };
  return { ok: true, email: lower };
}

export type ParsedMentoringCsvOk = {
  headerIndex: Map<string, number>;
  rows: Array<{ rowNumber: number; values: Record<FrontierMentoringCsvHeader, string> }>;
};

export type ParsedMentoringCsvResult =
  | { ok: true; data: ParsedMentoringCsvOk }
  | { ok: false; error: string };

export function parseFrontierMentoringCsv(text: string): ParsedMentoringCsvResult {
  const normalized = text.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2) {
    return { ok: false, error: "CSV must include a header row and at least one data row." };
  }

  const headerCells = parseCsvLine(lines[0]).map((h) => h.trim());
  const headerIndex = new Map<string, number>();
  headerCells.forEach((h, i) => {
    if (h && !headerIndex.has(h)) headerIndex.set(h, i);
  });

  for (const required of FRONTIER_MENTORING_CSV_HEADERS) {
    if (!headerIndex.has(required)) {
      return { ok: false, error: `Missing required column: ${required}` };
    }
  }

  const rows: ParsedMentoringCsvOk["rows"] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const values = {} as Record<FrontierMentoringCsvHeader, string>;
    for (const key of FRONTIER_MENTORING_CSV_HEADERS) {
      const idx = headerIndex.get(key)!;
      values[key] = (cells[idx] ?? "").trim();
    }
    const rowNumber = i + 1;
    rows.push({ rowNumber, values });
  }

  return { ok: true, data: { headerIndex, rows } };
}
