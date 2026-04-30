import type {
  EnrouteRiskLevel,
  EnrouteStationForecastSummary,
  EnrouteStationRiskInput,
} from "./types";

const DASH = "—";

/** NBM `windLabel`: e.g. `270° 12` or `270° 25G35`. */
function forecastWindLabelIsStrong(windLabel: string): boolean {
  const t = windLabel.trim();
  if (!t || t === DASH) return false;
  const m = /^(\d+)°\s+(\d+)(?:G(\d+))?$/.exec(t);
  if (!m) return false;
  const sustained = Number(m[2]);
  const gust = m[3] != null ? Number(m[3]) : sustained;
  if (!Number.isFinite(sustained)) return false;
  /** Sustained or peak wind/gust treated as enroute planning bump (kt). */
  return sustained >= 30 || (Number.isFinite(gust) && gust >= 35);
}

function forecastLabelsSuggestConvection(f: EnrouteStationForecastSummary): boolean {
  const blob = [f.ceilingLabel, f.visibilityLabel, f.windLabel].join(" ").toLowerCase();
  return /thunder|tstm|convect/.test(blob);
}

/**
 * Deterministic per-station risk from METAR + PIREP summaries, then optional NBM forecast.
 * First matching rule wins (priority order).
 */
export function computeEnrouteRiskLevel(station: EnrouteStationRiskInput): EnrouteRiskLevel {
  const { metar, pirep } = station;

  // 1 — Convective (METAR wx or PIREP)
  if (metar.hasConvectiveWx || pirep.convectionReported) return "HIGH";

  // 2 — IFR (LIFR should be rolled into IFR when building metar summary)
  if (metar.flightCategory === "IFR") return "HIGH";

  // 3 — Severe turbulence or icing
  if (pirep.turbulenceMax === "SEV" || pirep.icingMax === "SEV") return "HIGH";

  // 4 — MVFR
  if (metar.flightCategory === "MVFR") return "MODERATE";

  // 5 — Moderate turbulence or icing
  if (pirep.turbulenceMax === "MOD" || pirep.icingMax === "MOD") return "MODERATE";

  // 6 — Light / trace PIREP hazards
  if (
    pirep.turbulenceMax === "LGT" ||
    pirep.icingMax === "TRACE" ||
    pirep.icingMax === "LGT"
  ) {
    return "LOW";
  }

  const fc = station.forecast;
  if (fc) {
    // 7 — NBM IFR (LIFR-equivalent is rolled into IFR in `mapNbmForecastStepToSummary`)
    if (fc.flightCategory === "IFR") return "HIGH";

    // 8 — NBM thunder / convective cue (structured flag or label text)
    if (fc.hasThunder || forecastLabelsSuggestConvection(fc)) return "HIGH";

    // 9 — NBM MVFR
    if (fc.flightCategory === "MVFR") return "MODERATE";

    // 10 — NBM strong sustained wind or gust (decoded from `windLabel`)
    if (forecastWindLabelIsStrong(fc.windLabel)) return "MODERATE";
  }

  // 11 — Clean VFR and no hazard matched above (UNKNOWN PIREP maxes treated as non-escalating)
  if (metar.flightCategory === "VFR") return "NONE";

  // 12 — e.g. UNKNOWN category with no hazards
  return "NONE";
}
