/**
 * Server-only helper for airport timezone lookups.
 * Single source of truth for IATA → IANA timezone.
 */

import { createAdminClient } from "@/lib/supabase/admin";

function isTzValid(tz: string | null | undefined): boolean {
  const s = (tz ?? "").trim();
  return s.length > 0;
}

/** Look up IANA timezone for an airport by IATA code. Falls back to "UTC" if missing. */
export async function getAirportTz(iata: string): Promise<string> {
  if (!iata || iata.length !== 3) return "UTC";
  const admin = createAdminClient();
  const { data } = await admin
    .from("airports")
    .select("tz")
    .eq("iata", iata.toUpperCase())
    .maybeSingle();
  const tz = data?.tz;
  if (!isTzValid(tz)) {
    console.warn(`[airports] Timezone data missing for airport: ${iata.toUpperCase()}`);
    return "UTC";
  }
  return tz!;
}

/** Get timezones for origin and destination airports. */
export async function getRouteTzs(
  origin: string,
  destination: string
): Promise<{ originTz: string; destTz: string }> {
  const [originTz, destTz] = await Promise.all([
    getAirportTz(origin),
    getAirportTz(destination),
  ]);
  return { originTz, destTz };
}
