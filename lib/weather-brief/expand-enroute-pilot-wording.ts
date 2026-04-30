/**
 * Pilot-facing wording expansions for enroute summaries (deterministic; no fetch impact).
 */

/** USPS-style 2-letter codes → full names (50 states + DC). */
export const US_STATE_ABBR_TO_NAME: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

export function usStateAbbrevToName(abbr: string): string {
  const k = abbr.trim().toUpperCase();
  return US_STATE_ABBR_TO_NAME[k] ?? abbr;
}

/**
 * Spell out common SIGMET/AIRMET abbreviations for card readability. IFR is left as-is.
 */
export function expandAviationAbbreviationsInPilotSummary(summary: string): string {
  let t = summary;

  t = t.replace(/\bSTG\s+WNDS\b/gi, "strong winds");
  t = t.replace(/\bSTG\s+winds\b/gi, "strong winds");
  t = t.replace(/\bstrong winds\s*\(\s*STG\s*\)/gi, "strong winds");
  t = t.replace(/\s*\(\s*STG\s*\)/gi, "");

  t = t.replace(/\bMTN\s+OBSCN\b/gi, "mountain obscuration");
  t = t.replace(/\bMTN\s+OBSC\b/gi, "mountain obscuration");

  t = t.replace(/\bTURB\b/g, "turbulence");

  t = t.replace(/\bLLWS\b/g, "low-level wind shear");

  return t.replace(/\s{2,}/g, " ").trim();
}

const EM_DASH = "\u2014";

/**
 * Card typography: cap after ". ", cap after " / " in hazard, hyphenated Low-Level-Wind-Shear, "Region" capitalized.
 */
export function formatEnroutePilotSummaryTypography(summary: string): string {
  let s = summary.replace(/\s{2,}/g, " ").trim();

  s = s.replace(/\blow-level wind shear\b/gi, "Low-Level-Wind-Shear");

  s = s.replace(/\bdeparture\s+region\b/gi, "departure Region");
  s = s.replace(/\barrival\s+region\b/gi, "arrival Region");

  const firstDot = s.indexOf(". ");
  if (firstDot !== -1) {
    let head = s.slice(0, firstDot);
    const tail = s.slice(firstDot);

    const emIdx = head.indexOf(EM_DASH);
    if (emIdx !== -1) {
      const before = head.slice(0, emIdx + EM_DASH.length);
      let hazard = head.slice(emIdx + EM_DASH.length).trimStart();
      if (hazard.length > 0) {
        hazard = hazard
          .split(/\s*\/\s*/)
          .map((part) => {
            const t = part.trim();
            if (!t) return t;
            return t.charAt(0).toUpperCase() + t.slice(1);
          })
          .join(" / ");
      }
      head = `${before} ${hazard}`.trimEnd();
    }
    s = head + tail;
  } else {
    const emIdx = s.indexOf(EM_DASH);
    if (emIdx !== -1) {
      const before = s.slice(0, emIdx + EM_DASH.length);
      let hazard = s.slice(emIdx + EM_DASH.length).trimStart();
      if (hazard.length > 0) {
        hazard = hazard
          .split(/\s*\/\s*/)
          .map((part) => {
            const t = part.trim();
            if (!t) return t;
            return t.charAt(0).toUpperCase() + t.slice(1);
          })
          .join(" / ");
      }
      s = `${before} ${hazard}`.trimEnd();
    }
  }

  s = s.replace(/(\.\s+)([a-z])/g, (_m, punct: string, letter: string) => punct + letter.toUpperCase());

  return s.replace(/\s{2,}/g, " ").trim();
}
