/**
 * Global cache for FlightAware filed routes. Shared across users to reduce API calls.
 */

import { createClient } from "@/lib/supabase/server";

export async function getCachedRoute(
  ident: string,
  departureIso: string
): Promise<{ route: string; last_checked: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("flight_route_cache")
    .select("route, last_checked")
    .eq("ident", ident)
    .eq("departure_iso", departureIso)
    .maybeSingle();

  if (error || !data) return null;
  const route = (data as { route?: string }).route;
  const last_checked = (data as { last_checked?: string }).last_checked;
  if (!route?.trim() || !last_checked) return null;
  return { route: route.trim(), last_checked };
}

export async function storeRouteInCache(
  ident: string,
  origin: string,
  destination: string,
  departureIso: string,
  route: string
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("flight_route_cache").upsert(
    {
      ident,
      origin,
      destination,
      departure_iso: departureIso,
      route,
      last_checked: new Date().toISOString(),
    },
    { onConflict: "ident,departure_iso" }
  );
}
