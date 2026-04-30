import type { EnrouteFlightCategory, EnrouteStationForecastSummary } from "./types";

const DASH = "—";

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Match METAR mapper pilot visibility formatting for numeric SM. */
function formatStatuteMilesLabel(sm: number): string {
  if (!Number.isFinite(sm) || sm < 0) return DASH;
  if (sm >= 10) return "10+ SM";

  const near = (a: number, b: number) => Math.abs(a - b) < 0.021;
  if (near(sm, 0.25)) return "1/4 SM";
  if (near(sm, 0.5)) return "1/2 SM";
  if (near(sm, 0.75)) return "3/4 SM";

  const r = Math.round(sm * 100) / 100;
  if (Number.isInteger(r) && r >= 1 && r <= 9) return `${r} SM`;

  const whole = Math.floor(sm);
  if (whole >= 1 && near(sm - whole, 0.5)) return `${whole} 1/2 SM`;

  return `${r} SM`;
}

function isCeilingUnlimited(ceiling: Record<string, unknown>): boolean {
  const repr = typeof ceiling.repr === "string" ? ceiling.repr.trim() : "";
  if (repr === "888" || /^888+$/.test(repr)) return true;
  const spoken = typeof ceiling.spoken === "string" ? ceiling.spoken.toLowerCase() : "";
  if (spoken.includes("unlimited")) return true;
  if (ceiling.value === null && repr.includes("888")) return true;
  return false;
}

function ceilingFeetFrom(ceiling: unknown): { ft: number | null; unlimited: boolean } {
  if (!isPlainObject(ceiling)) return { ft: null, unlimited: false };
  if (isCeilingUnlimited(ceiling)) return { ft: null, unlimited: true };
  const v = ceiling.value;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return { ft: Math.round(v), unlimited: false };
  }
  return { ft: null, unlimited: false };
}

function ceilingLabelFrom(ceiling: unknown): string {
  if (!isPlainObject(ceiling)) return DASH;
  if (isCeilingUnlimited(ceiling)) return "CLR";
  const v = ceiling.value;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return `${Math.round(v)} ft`;
  }
  return DASH;
}

function visibilitySmFromPeriod(period: Record<string, unknown>): number | null {
  const vis = period.visibility;
  if (!isPlainObject(vis)) return null;
  const val = vis.value;
  if (typeof val === "number" && Number.isFinite(val) && val >= 0) return val;
  return null;
}

function visibilityLabelFromPeriod(period: Record<string, unknown>): string {
  const sm = visibilitySmFromPeriod(period);
  if (sm == null) return DASH;
  return formatStatuteMilesLabel(sm);
}

function deriveFlightCategory(
  visSm: number | null,
  ceilingFt: number | null,
  ceilingUnlimited: boolean
): EnrouteFlightCategory {
  const hasVis = visSm != null;
  const hasCeilingConstraint = ceilingUnlimited || ceilingFt != null;

  const ifrByVis = hasVis && visSm! < 3;
  const ifrByCeil =
    !ceilingUnlimited && ceilingFt != null && ceilingFt < 1000;
  if (ifrByVis || ifrByCeil) return "IFR";

  const mvfrByVis = hasVis && visSm! >= 3 && visSm! < 5;
  const mvfrByCeil =
    !ceilingUnlimited &&
    ceilingFt != null &&
    ceilingFt >= 1000 &&
    ceilingFt < 3000;
  if (mvfrByVis || mvfrByCeil) return "MVFR";

  const vfrByVis = hasVis && visSm! >= 5;
  const vfrByCeil =
    ceilingUnlimited || (ceilingFt != null && ceilingFt >= 3000);
  if (vfrByVis && vfrByCeil) return "VFR";

  return "UNKNOWN";
}

function numField(obj: unknown, key: string): number | null {
  if (!isPlainObject(obj)) return null;
  const v = obj[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function windLabelFrom(period: Record<string, unknown>): string {
  const dir = numField(period.wind_direction, "value");
  const spd = numField(period.wind_speed, "value");
  const gst = numField(period.wind_gust, "value");

  if (dir == null || spd == null) return DASH;

  let s = `${Math.round(dir)}° ${Math.round(spd)}`;
  if (gst != null && gst > spd) {
    s += `G${Math.round(gst)}`;
  }
  return s;
}

function hasThunderFrom(period: Record<string, unknown>): boolean {
  const t3 = numField(period.thunderstorm_3, "value") ?? 0;
  const t12 = numField(period.thunderstorm_12, "value") ?? 0;
  return Math.max(t3, t12) >= 15;
}

function hasIcingFrom(period: Record<string, unknown>): boolean {
  const v = numField(period.icing_amount_6, "value");
  return v != null && v > 0;
}

function forecastAtFrom(period: Record<string, unknown>): string | null {
  const t = period.time;
  if (!isPlainObject(t)) return null;
  const dt = t.dt;
  if (typeof dt !== "string" || !dt.trim()) return null;
  const d = new Date(dt.trim());
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Maps one AVWX-parsed NBM `forecast[]` period to a pilot-facing summary.
 */
export function mapNbmForecastStepToSummary(
  period: unknown
): EnrouteStationForecastSummary {
  if (!isPlainObject(period)) {
    return {
      flightCategory: "UNKNOWN",
      ceilingLabel: DASH,
      visibilityLabel: DASH,
      windLabel: DASH,
      hasThunder: false,
      hasIcing: false,
      forecastAt: null,
    };
  }

  const visSm = visibilitySmFromPeriod(period);
  const { ft: ceilFt, unlimited: ceilUnlimited } = ceilingFeetFrom(period.ceiling);

  const flightCategory = deriveFlightCategory(visSm, ceilFt, ceilUnlimited);
  const ceilingLabel = ceilingLabelFrom(period.ceiling);
  const visibilityLabel = visibilityLabelFromPeriod(period);
  const windLabel = windLabelFrom(period);
  const hasThunder = hasThunderFrom(period);
  const hasIcing = hasIcingFrom(period);
  const forecastAt = forecastAtFrom(period);

  return {
    flightCategory,
    ceilingLabel,
    visibilityLabel,
    windLabel,
    hasThunder,
    hasIcing,
    forecastAt,
  };
}
