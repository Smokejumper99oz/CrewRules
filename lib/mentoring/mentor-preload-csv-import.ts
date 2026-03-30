/**
 * Mentor preload CSV: headers and parsing (server-side).
 */

export const MENTOR_PRELOAD_CSV_HEADERS = [
  "mentor_full_name",
  "mentor_employee_number",
  "mentor_phone_number",
  "mentor_email_@flyfrontier.com",
  "notes",
] as const;

export type MentorPreloadCsvHeader = (typeof MENTOR_PRELOAD_CSV_HEADERS)[number];

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
  rows: Array<{ rowNumber: number; values: Record<MentorPreloadCsvHeader, string> }>;
};

export type ParsedMentorPreloadCsvResult =
  | { ok: true; data: ParsedMentorPreloadCsvOk }
  | { ok: false; error: string };

/**
 * Validates header row contains every required column (exact names) and parses body rows with trimmed cells.
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

  for (const required of MENTOR_PRELOAD_CSV_HEADERS) {
    if (!headerIndex.has(required)) {
      return { ok: false, error: `Missing required column: ${required}` };
    }
  }

  const rows: ParsedMentorPreloadCsvOk["rows"] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const values = {} as Record<MentorPreloadCsvHeader, string>;
    for (const key of MENTOR_PRELOAD_CSV_HEADERS) {
      const idx = headerIndex.get(key)!;
      values[key] = (cells[idx] ?? "").trim();
    }
    rows.push({ rowNumber: i + 1, values });
  }

  return { ok: true, data: { headerIndex, rows } };
}
