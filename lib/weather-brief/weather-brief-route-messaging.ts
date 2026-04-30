/**
 * Display-only route/corridor certainty for Weather Brief messaging.
 * Pair with fetched `filedRoute` text length and built `enrouteStations.length`.
 */

export type WeatherBriefRouteMessagingState = {
  hasFiledRoute: boolean;
  /** True when a meaningful corridor exists (more than dep + arrival only). */
  hasCorridorData: boolean;
};

export type RouteCorridorCertaintyTier = "awaiting_route" | "limited_corridor" | "full_corridor";

export function computeWeatherBriefRouteMessagingState(
  filedRouteText: string | null | undefined,
  enrouteStationsCount: number
): WeatherBriefRouteMessagingState {
  const trimmed = filedRouteText?.trim() ?? "";
  const hasFiledRoute = trimmed.length > 0;
  const hasCorridorData = hasFiledRoute && enrouteStationsCount > 2;
  return { hasFiledRoute, hasCorridorData };
}

export function routeCorridorCertaintyTier(state: WeatherBriefRouteMessagingState): RouteCorridorCertaintyTier {
  if (!state.hasFiledRoute) return "awaiting_route";
  if (!state.hasCorridorData) return "limited_corridor";
  return "full_corridor";
}

/**
 * Route sampling / corridor banners (not the “no hazards” all-clear).
 * Returns null when the full corridor is available.
 */
export function enrouteCorridorAvailabilityMessage(state: WeatherBriefRouteMessagingState): string | null {
  const t = routeCorridorCertaintyTier(state);
  if (t === "awaiting_route") {
    return "Enroute weather will be evaluated once your filed route is available.";
  }
  if (t === "limited_corridor") {
    return "Limited enroute weather scan based on available route data.";
  }
  return null;
}

/** Enroute Weather / SIGMET-AIRMET card when zero display advisories. */
export function enrouteHazardsCertaintyMessage(state: WeatherBriefRouteMessagingState): string {
  const t = routeCorridorCertaintyTier(state);
  if (t === "awaiting_route") {
    return "Enroute weather will be evaluated once your filed route is available.";
  }
  if (t === "limited_corridor") {
    return "Limited enroute weather scan based on available route data.";
  }
  return "No significant enroute weather hazards detected along your filed route.";
}

/** CrewRules™ Enroute Performance™ (winds/fuel card) section context banner. */
export function enroutePerformanceCertaintyMessage(state: WeatherBriefRouteMessagingState): string | null {
  const t = routeCorridorCertaintyTier(state);
  if (t === "awaiting_route") {
    return "Performance analysis will populate once your filed route is available.";
  }
  if (t === "limited_corridor") {
    return "Limited performance analysis based on available route data.";
  }
  return null;
}

/** Pilot Summary "Enroute" line when advisory list for the window is empty. */
export function pilotSummaryEmptyEnrouteMessage(state: WeatherBriefRouteMessagingState): string {
  const t = routeCorridorCertaintyTier(state);
  if (t === "awaiting_route") {
    return "Enroute analysis will populate once your filed route is available.";
  }
  if (t === "limited_corridor") {
    return "Limited enroute analysis based on available route data.";
  }
  return "No significant enroute weather hazards detected along your filed route. See CrewRules™ Enroute Intelligence™ below.";
}
