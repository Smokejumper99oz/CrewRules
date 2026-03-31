/**
 * Converts the **first worksheet only** of an .xlsx workbook into CSV text that
 * `parseFrontierMentoringCsv` / `parseMentorPreloadCsv` accept (each uses its own required header list).
 *
 * - Uses SheetJS (`xlsx`) with `cellDates: true` so Excel date cells become `Date` when supported.
 * - Coerces every cell to string for output; trims headers to match CSV behavior.
 * - Dates: `Date` → YYYY-MM-DD (UTC calendar parts); fractional Excel serials → SSF date; whole-number
 *   serials in 40000–50000 are treated as Excel day counts (hire_date column often); otherwise
 *   whole numbers stringify as integers (employee numbers, etc.).
 */

import * as XLSX from "xlsx";
import {
  mentorPreloadImportHeaderValidationError,
  mentorPreloadSheetOutputHeaderList,
} from "@/lib/mentoring/mentor-preload-csv-import";
import { FRONTIER_MENTORING_CSV_HEADERS } from "@/lib/mentoring/mentoring-csv-import";

/** RFC 4180-style quoted fields so commas/quotes in cells round-trip through existing CSV parsers. */
function encodeCsvRow(fields: string[]): string {
  return fields.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(",");
}

function cellToTrimmedString(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    const y = v.getUTCFullYear();
    const m = v.getUTCMonth() + 1;
    const d = v.getUTCDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const iv = Math.round(v);
    const isWhole = Math.abs(v - iv) < 1e-6;
    if (isWhole && iv >= 40000 && iv <= 50000) {
      const p = XLSX.SSF.parse_date_code(v);
      if (p && p.y != null && p.m != null && p.d != null && p.y >= 1995 && p.y <= 2040) {
        return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
      }
    }
    if (!isWhole) {
      const p = XLSX.SSF.parse_date_code(v);
      if (p && p.y != null && p.m != null && p.d != null && p.y >= 1980 && p.y <= 2060) {
        return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
      }
    }
    if (isWhole) return String(iv);
    return String(v);
  }
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v).trim();
}

function workbookFirstSheetToAoA(buffer: ArrayBuffer): unknown[][] | null {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const name = workbook.SheetNames[0];
  if (!name) return null;
  const sheet = workbook.Sheets[name];
  if (!sheet) return null;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  return rows as unknown[][];
}

/** Header cells: literal strings only (no Excel serial → date) so column names stay exact. */
function headerCellStrings(row: unknown[], width: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < width; i++) {
    const v = row[i];
    if (v == null || v === "") {
      out.push("");
      continue;
    }
    if (typeof v === "string") {
      out.push(v.trim());
      continue;
    }
    if (typeof v === "number" && Number.isFinite(v)) {
      out.push(String(Math.round(v)));
      continue;
    }
    out.push(String(v).trim());
  }
  return out;
}

function rowStrings(row: unknown[], width: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < width; i++) {
    out.push(cellToTrimmedString(row[i]));
  }
  return out;
}

function isRowAllBlank(cells: string[]): boolean {
  return cells.every((c) => c.trim() === "");
}

/** Mentee assignment template → CSV text for `parseFrontierMentoringCsv` (first worksheet only). */
export function frontierMentoringAssignXlsxToCsvText(
  buffer: ArrayBuffer,
): { ok: true; csvText: string } | { ok: false; error: string } {
  return mentoringAssignXlsxBufferToCsvText(buffer, FRONTIER_MENTORING_CSV_HEADERS);
}

/** Mentor preload template → CSV text for `parseMentorPreloadCsv` (first worksheet only). */
export function mentorPreloadXlsxToCsvText(
  buffer: ArrayBuffer,
): { ok: true; csvText: string } | { ok: false; error: string } {
  const aoa = workbookFirstSheetToAoA(buffer);
  if (!aoa || aoa.length < 2) {
    return { ok: false, error: "Workbook must have a first sheet with a header row and at least one data row." };
  }

  const headerRowRaw = aoa[0] as unknown[];
  const headerCells = headerCellStrings(
    headerRowRaw,
    Math.max(headerRowRaw.length, 12),
  );
  const headerIndex = new Map<string, number>();
  headerCells.forEach((h, i) => {
    const key = h.trim();
    if (key && !headerIndex.has(key)) headerIndex.set(key, i);
  });

  const headerErr = mentorPreloadImportHeaderValidationError(headerIndex);
  if (headerErr) {
    return { ok: false, error: headerErr };
  }

  const outputHeaders = mentorPreloadSheetOutputHeaderList(headerIndex);
  const maxCol =
    Math.max(
      0,
      ...outputHeaders.map((h) => headerIndex.get(h)!),
      ...headerIndex.values(),
    ) + 1;

  const lines: string[] = [];
  lines.push(encodeCsvRow([...outputHeaders]));

  for (let r = 1; r < aoa.length; r++) {
    const raw = aoa[r] as unknown[];
    const wide = rowStrings(raw, Math.max(raw?.length ?? 0, maxCol));
    const values = outputHeaders.map((h) => wide[headerIndex.get(h)!] ?? "");
    if (isRowAllBlank(values)) continue;
    lines.push(encodeCsvRow(values));
  }

  if (lines.length < 2) {
    return { ok: false, error: "No non-empty data rows found in the first worksheet." };
  }

  return { ok: true, csvText: lines.join("\n") };
}

function mentoringAssignXlsxBufferToCsvText(
  buffer: ArrayBuffer,
  requiredHeaders: readonly string[],
  optionalHeaders: readonly string[] = [],
): { ok: true; csvText: string } | { ok: false; error: string } {
  const aoa = workbookFirstSheetToAoA(buffer);
  if (!aoa || aoa.length < 2) {
    return { ok: false, error: "Workbook must have a first sheet with a header row and at least one data row." };
  }

  const headerRowRaw = aoa[0] as unknown[];
  const headerCells = headerCellStrings(
    headerRowRaw,
    Math.max(headerRowRaw.length, requiredHeaders.length + optionalHeaders.length),
  );
  const headerIndex = new Map<string, number>();
  headerCells.forEach((h, i) => {
    const key = h.trim();
    if (key && !headerIndex.has(key)) headerIndex.set(key, i);
  });

  for (const required of requiredHeaders) {
    if (!headerIndex.has(required)) {
      return { ok: false, error: `Missing required column: ${required}` };
    }
  }

  const outputHeaders = [
    ...requiredHeaders,
    ...optionalHeaders.filter((h) => headerIndex.has(h)),
  ];

  const maxCol =
    Math.max(...outputHeaders.map((h) => headerIndex.get(h)!), ...headerIndex.values()) + 1;
  const lines: string[] = [];
  lines.push(encodeCsvRow([...outputHeaders]));

  for (let r = 1; r < aoa.length; r++) {
    const raw = aoa[r] as unknown[];
    const wide = rowStrings(raw, Math.max(raw?.length ?? 0, maxCol));
    const values = outputHeaders.map((h) => wide[headerIndex.get(h)!] ?? "");
    if (isRowAllBlank(values)) continue;
    lines.push(encodeCsvRow(values));
  }

  if (lines.length < 2) {
    return { ok: false, error: "No non-empty data rows found in the first worksheet." };
  }

  return { ok: true, csvText: lines.join("\n") };
}
