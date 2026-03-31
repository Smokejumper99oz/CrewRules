/**
 * Mentor preload CSV: headers and parsing (server-side).
 */

/** Required columns (existing imports); file must include all of these. */
export const MENTOR_PRELOAD_CSV_REQUIRED_HEADERS = [
  "mentor_full_name",
  "mentor_employee_number",
  "mentor_phone_number",
  "mentor_email_@flyfrontier.com",
  "notes",
] as const;

/** Optional staging columns; honored when present in the header row. */
export const MENTOR_PRELOAD_CSV_OPTIONAL_HEADERS = [
  "mentor_position",
  "mentor_base_airport",
] as const;

/** @deprecated Use MENTOR_PRELOAD_CSV_REQUIRED_HEADERS (same values). */
export const MENTOR_PRELOAD_CSV_HEADERS = MENTOR_PRELOAD_CSV_REQUIRED_HEADERS;

export type MentorPreloadCsvRequiredHeader =
  (typeof MENTOR_PRELOAD_CSV_REQUIRED_HEADERS)[number];
export type MentorPreloadCsvOptionalHeader =
  (typeof MENTOR_PRELOAD_CSV_OPTIONAL_HEADERS)[number];

export type MentorPreloadCsvCellHeader =
  | MentorPreloadCsvRequiredHeader
  | MentorPreloadCsvOptionalHeader;

export type MentorPreloadCsvRowValues = Record<MentorPreloadCsvCellHeader, string>;

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

export type ParsedMentorPreloadCsvOk = {
  headerIndex: Map<string, number>;
  optionalPresent: {
    mentor_position: boolean;
    mentor_base_airport: boolean;
  };
  rows: Array<{ rowNumber: number; values: MentorPreloadCsvRowValues }>;
};

export type ParsedMentorPreloadCsvResult =
  | { ok: true; data: ParsedMentorPreloadCsvOk }
  | { ok: false; error: string };

/**
 * Validates required header columns (exact names). Optional columns are read when their headers exist.
 */
export function parseMentorPreloadCsv(text: string): ParsedMentorPreloadCsvResult {
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

  for (const required of MENTOR_PRELOAD_CSV_REQUIRED_HEADERS) {
    if (!headerIndex.has(required)) {
      return { ok: false, error: `Missing required column: ${required}` };
    }
  }

  const optionalPresent = {
    mentor_position: headerIndex.has("mentor_position"),
    mentor_base_airport: headerIndex.has("mentor_base_airport"),
  };

  const rows: ParsedMentorPreloadCsvOk["rows"] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const values = {} as Record<string, string>;
    for (const key of MENTOR_PRELOAD_CSV_REQUIRED_HEADERS) {
      const idx = headerIndex.get(key)!;
      values[key] = (cells[idx] ?? "").trim();
    }
    for (const key of MENTOR_PRELOAD_CSV_OPTIONAL_HEADERS) {
      if (optionalPresent[key]) {
        const idx = headerIndex.get(key)!;
        values[key] = (cells[idx] ?? "").trim();
      } else {
        values[key] = "";
      }
    }
    rows.push({
      rowNumber: i + 1,
      values: values as MentorPreloadCsvRowValues,
    });
  }

  return { ok: true, data: { headerIndex, optionalPresent, rows } };
}
