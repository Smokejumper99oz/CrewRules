/**
 * Mentor preload CSV: headers and parsing (server-side).
 */

/** Work email column (maps to mentor_preload.work_email). */
export const MENTOR_PRELOAD_CSV_WORK_EMAIL_HEADER = "mentor_email_@flyfrontier.com" as const;

/** Personal / mentoring email column (maps to mentor_preload.personal_email). */
export const MENTOR_PRELOAD_CSV_PERSONAL_EMAIL_HEADER = "mentor_email_@for.mentoring" as const;

/** Required for every import: identity fields + notes. */
export const MENTOR_PRELOAD_CSV_REQUIRED_HEADERS = [
  "mentor_full_name",
  "mentor_employee_number",
  "mentor_phone_number",
  "notes",
] as const;

/**
 * Email columns are not individually required if the other is present.
 * At least one of WORK + PERSONAL must appear in the header row.
 */
export const MENTOR_PRELOAD_CSV_EMAIL_HEADERS = [
  MENTOR_PRELOAD_CSV_WORK_EMAIL_HEADER,
  MENTOR_PRELOAD_CSV_PERSONAL_EMAIL_HEADER,
] as const;

/**
 * Staging columns (maps to mentor_preload.position / base_airport).
 * Prefer `role` / `crew_base` when present; legacy `mentor_position` / `mentor_base_airport` still accepted.
 */
export const MENTOR_PRELOAD_CSV_STAGING_OPTIONAL_HEADERS = [
  "role",
  "crew_base",
  "mentor_position",
  "mentor_base_airport",
] as const;

/**
 * Import-only optional columns (preserved in parse output; not yet mapped in run-mentor-preload-csv-import).
 */
export const MENTOR_PRELOAD_CSV_PROGRAM_STATUS_SEAT_HEADERS = [
  "program",
  "status",
  "seat",
] as const;

/** Value keys read into each row beyond core required (empty string if header absent). */
export const MENTOR_PRELOAD_CSV_KNOWN_OPTIONAL_CELL_HEADERS = [
  ...MENTOR_PRELOAD_CSV_EMAIL_HEADERS,
  ...MENTOR_PRELOAD_CSV_STAGING_OPTIONAL_HEADERS,
  ...MENTOR_PRELOAD_CSV_PROGRAM_STATUS_SEAT_HEADERS,
] as const;

/** @deprecated Prefer MENTOR_PRELOAD_CSV_REQUIRED_HEADERS + KNOWN_OPTIONAL. */
export const MENTOR_PRELOAD_CSV_OPTIONAL_HEADERS = MENTOR_PRELOAD_CSV_KNOWN_OPTIONAL_CELL_HEADERS;

/** Canonical full template row for docs / XLSX column order. */
export const MENTOR_PRELOAD_CSV_HEADERS = [
  ...MENTOR_PRELOAD_CSV_REQUIRED_HEADERS,
  ...MENTOR_PRELOAD_CSV_EMAIL_HEADERS,
  ...MENTOR_PRELOAD_CSV_STAGING_OPTIONAL_HEADERS,
  ...MENTOR_PRELOAD_CSV_PROGRAM_STATUS_SEAT_HEADERS,
] as const;

export type MentorPreloadCsvRequiredHeader = (typeof MENTOR_PRELOAD_CSV_REQUIRED_HEADERS)[number];
export type MentorPreloadCsvStagingOptionalHeader =
  (typeof MENTOR_PRELOAD_CSV_STAGING_OPTIONAL_HEADERS)[number];
export type MentorPreloadCsvProgramStatusSeatHeader =
  (typeof MENTOR_PRELOAD_CSV_PROGRAM_STATUS_SEAT_HEADERS)[number];
export type MentorPreloadCsvOptionalHeader = (typeof MENTOR_PRELOAD_CSV_KNOWN_OPTIONAL_CELL_HEADERS)[number];
export type MentorPreloadCsvCellHeader = MentorPreloadCsvRequiredHeader | MentorPreloadCsvOptionalHeader;

export type MentorPreloadCsvRowValues = Record<MentorPreloadCsvCellHeader, string>;

/** Which optional / email column names appeared in the file header row (drives DB merge behavior). */
export type MentorPreloadCsvHeaderPresence = {
  workEmail: boolean;
  personalEmail: boolean;
  role: boolean;
  crewBase: boolean;
  mentorPosition: boolean;
  mentorBaseAirport: boolean;
  program: boolean;
  status: boolean;
  seat: boolean;
};

export function mentorPreloadImportHeaderValidationError(headerIndex: Map<string, number>): string | null {
  for (const required of MENTOR_PRELOAD_CSV_REQUIRED_HEADERS) {
    if (!headerIndex.has(required)) {
      return `Missing required column: ${required}`;
    }
  }
  const hasWork = headerIndex.has(MENTOR_PRELOAD_CSV_WORK_EMAIL_HEADER);
  const hasPersonal = headerIndex.has(MENTOR_PRELOAD_CSV_PERSONAL_EMAIL_HEADER);
  if (!hasWork && !hasPersonal) {
    return `Missing required column: include at least one of ${MENTOR_PRELOAD_CSV_WORK_EMAIL_HEADER}, ${MENTOR_PRELOAD_CSV_PERSONAL_EMAIL_HEADER}`;
  }
  return null;
}

/** Column order for XLSX → CSV output (matches known headers present on the sheet). */
export function mentorPreloadSheetOutputHeaderList(headerIndex: Map<string, number>): string[] {
  const out: string[] = [...MENTOR_PRELOAD_CSV_REQUIRED_HEADERS];
  if (headerIndex.has(MENTOR_PRELOAD_CSV_WORK_EMAIL_HEADER)) {
    out.push(MENTOR_PRELOAD_CSV_WORK_EMAIL_HEADER);
  }
  if (headerIndex.has(MENTOR_PRELOAD_CSV_PERSONAL_EMAIL_HEADER)) {
    out.push(MENTOR_PRELOAD_CSV_PERSONAL_EMAIL_HEADER);
  }
  for (const h of MENTOR_PRELOAD_CSV_STAGING_OPTIONAL_HEADERS) {
    if (headerIndex.has(h)) out.push(h);
  }
  for (const h of MENTOR_PRELOAD_CSV_PROGRAM_STATUS_SEAT_HEADERS) {
    if (headerIndex.has(h)) out.push(h);
  }
  return out;
}

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
  optionalPresent: MentorPreloadCsvHeaderPresence;
  rows: Array<{ rowNumber: number; values: MentorPreloadCsvRowValues }>;
};

export type ParsedMentorPreloadCsvResult =
  | { ok: true; data: ParsedMentorPreloadCsvOk }
  | { ok: false; error: string };

/**
 * Validates header row: core required + at least one email column.
 * Optional columns are read when present. Extra columns in file are ignored.
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

  const headerErr = mentorPreloadImportHeaderValidationError(headerIndex);
  if (headerErr) {
    return { ok: false, error: headerErr };
  }

  const optionalPresent: MentorPreloadCsvHeaderPresence = {
    workEmail: headerIndex.has(MENTOR_PRELOAD_CSV_WORK_EMAIL_HEADER),
    personalEmail: headerIndex.has(MENTOR_PRELOAD_CSV_PERSONAL_EMAIL_HEADER),
    role: headerIndex.has("role"),
    crewBase: headerIndex.has("crew_base"),
    mentorPosition: headerIndex.has("mentor_position"),
    mentorBaseAirport: headerIndex.has("mentor_base_airport"),
    program: headerIndex.has("program"),
    status: headerIndex.has("status"),
    seat: headerIndex.has("seat"),
  };

  const rows: ParsedMentorPreloadCsvOk["rows"] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const values = {} as Record<string, string>;
    for (const key of MENTOR_PRELOAD_CSV_REQUIRED_HEADERS) {
      const idx = headerIndex.get(key)!;
      values[key] = (cells[idx] ?? "").trim();
    }
    for (const key of MENTOR_PRELOAD_CSV_KNOWN_OPTIONAL_CELL_HEADERS) {
      if (headerIndex.has(key)) {
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
