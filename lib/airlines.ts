export const AIRLINE_DOMAINS: Record<string, string> = {
  // US majors
  AA: "aa.com",
  DL: "delta.com",
  UA: "united.com",
  WN: "southwest.com",

  // Low cost / others
  F9: "flyfrontier.com",
  NK: "spirit.com",
  B6: "jetblue.com",
  AS: "alaskaair.com",
  HA: "hawaiianairlines.com",
  G4: "allegiantair.com",
  SY: "suncountry.com",

  // Regionals / common codes (optional)
  OO: "skywest.com",
  YX: "republicairlines.com",
  MQ: "envoyair.com",
  "9E": "endeavorair.com",
};

/** Local logo path. Add PNG files to public/icons/airlines/{code}.png (e.g. B6.png, UA.png). */
export function getLocalAirlineLogoPath(carrier?: string | null): string | null {
  if (!carrier) return null;
  const code = (carrier ?? "").trim().toUpperCase().slice(0, 2);
  if (!code) return null;
  return `/icons/airlines/${code}.png`;
}

/** Favicon fallback when local logo missing. */
export function getAirlineLogoUrl(carrier?: string | null) {
  if (!carrier) return null;
  const code = carrier.toUpperCase();
  const domain = AIRLINE_DOMAINS[code];
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

/**
 * Airline codes for local logos. Upload PNG files (square, ~64–128px) to public/icons/airlines/.
 * Priority order for commute display: AA, B6, DL, F9, NK, UA, WN, AS, G4, HA, OO, SY, YX, MQ, 9E.
 */
export const AIRLINE_CODES_FOR_LOGOS = [
  "AA", "B6", "DL", "F9", "NK", "UA", "WN",  // Most common
  "AS", "G4", "HA", "OO", "SY", "YX", "MQ", "9E",
] as const;
