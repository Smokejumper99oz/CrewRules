/**
 * Server-only helper for airport timezone lookups.
 * Single source of truth for IATA → IANA timezone.
 */

import { createAdminClient } from "@/lib/supabase/admin";

/** Look up IANA timezone for an airport by IATA code. Falls back to "UTC" if missing. */
export async function getAirportTz(iata: string): Promise<string> {
  if (!iata || iata.length !== 3) return "UTC";
  const admin = createAdminClient();
  const { data } = await admin
    .from("airports")
    .select("tz")
    .eq("iata", iata.toUpperCase())
    .maybeSingle();
  return data?.tz ?? "UTC";
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
