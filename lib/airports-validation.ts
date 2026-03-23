/**
 * Airport validation utility for maintenance.
 * Detects airports with missing or invalid timezone data.
 * Use from super-admin or scripts.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type AirportValidationResult = {
  iata: string;
  tz: string | null;
  status: "ok" | "missing" | "invalid";
};

/** Check if tz is considered valid (non-empty, non-whitespace IANA identifier). */
function isTzValid(tz: string | null | undefined): boolean {
  const s = (tz ?? "").trim();
  return s.length > 0;
}

/**
 * Find airports with missing or invalid timezone data.
 * Returns list of { iata, tz, status } for maintenance.
 */
export async function findAirportsWithMissingTz(): Promise<AirportValidationResult[]> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("airports")
    .select("iata, tz");

  if (error) {
    throw new Error(`Airports validation failed: ${error.message}`);
  }

  const results: AirportValidationResult[] = [];
  for (const row of rows ?? []) {
    const iata = (row.iata ?? "").trim().toUpperCase();
    const tz = row.tz ?? null;
    const valid = isTzValid(tz);
    results.push({
      iata,
      tz,
      status: !iata ? "invalid" : valid ? "ok" : "missing",
    });
  }

  return results.filter((r) => r.status !== "ok");
}
