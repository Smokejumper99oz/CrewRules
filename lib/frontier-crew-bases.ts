/**
 * Single source of truth: Frontier pilot crew bases (stored `profiles.base_airport`).
 * Chicago dual-base is one stored value ORD with label "MDW/ORD".
 * MDW remains accepted server-side for legacy rows.
 */

export type FrontierCrewBaseOption = { readonly value: string; readonly label: string };

/** Canonical options for Crew Base dropdowns (value = stored IATA). */
export const FRONTIER_CREW_BASE_OPTIONS: readonly FrontierCrewBaseOption[] = [
  { value: "ATL", label: "ATL" },
  { value: "CLE", label: "CLE" },
  { value: "CVG", label: "CVG" },
  { value: "DEN", label: "DEN" },
  { value: "DFW", label: "DFW" },
  { value: "LAS", label: "LAS" },
  { value: "MIA", label: "MIA" },
  { value: "MCO", label: "MCO" },
  { value: "ORD", label: "MDW/ORD" },
  { value: "PHL", label: "PHL" },
  { value: "PHX", label: "PHX" },
  { value: "SJU", label: "SJU" },
  { value: "TPA", label: "TPA" },
] as const;

const CANONICAL_VALUES = new Set(FRONTIER_CREW_BASE_OPTIONS.map((o) => o.value));

const LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  FRONTIER_CREW_BASE_OPTIONS.map((o) => [o.value, o.label])
);

/** Stored codes that may appear in UI and validation (canonical only). */
export const FRONTIER_CREW_BASE_VALUES: readonly string[] = [...CANONICAL_VALUES];

/** True if this code is a valid Frontier crew base for create/update validation (includes legacy MDW). */
export function isAcceptedFrontierCrewBaseCode(code: string): boolean {
  const u = (code ?? "").trim().toUpperCase();
  if (!u) return false;
  return CANONICAL_VALUES.has(u) || u === "MDW";
}

/** Label for dropdowns; unknown codes return the code (e.g. legacy data). */
export function getFrontierCrewBaseLabel(value: string): string {
  const u = value.trim().toUpperCase();
  return LABEL_BY_VALUE[u] ?? u;
}
