/**
 * Normalize a FlightAware filed route into a ForeFlight-friendly route string.
 * Removes origin/destination airport codes and runway suffixes.
 */
export function normalizeRoute(route: string): string {
  const trimmed = route.trim();
  if (!trimmed) return trimmed;

  const tokens = trimmed.split(/\s+/);

  let start = 0;
  if (tokens.length > 0 && looksLikeAirportCode(tokens[0])) {
    start = 1;
  }

  let end = tokens.length;
  if (tokens.length > start && looksLikeAirportCode(tokens[tokens.length - 1])) {
    end = tokens.length - 1;
  }

  let cleaned = tokens.slice(start, end);

  if (cleaned.length > 0) {
    const last = cleaned[cleaned.length - 1];
    const withoutRunway = last.replace(/\.[0-9]{2}[LRC]?$/i, "");
    cleaned = [...cleaned.slice(0, -1), withoutRunway];
  }

  const result = cleaned.join(" ").trim();
  return result || trimmed;
}

function looksLikeAirportCode(token: string): boolean {
  return /^[A-Za-z]{3}$/.test(token) || /^[A-Za-z]{4}$/.test(token);
}
