import type { CommuteFlight } from "@/lib/aviationstack";

/** Narrow shape for gate fields from AviationStack or AeroDataBox commute rows. */
export type LegGateFields = Pick<CommuteFlight, "dep_gate" | "arr_gate">;

function normGate(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t.length > 0 ? t : null;
}

/**
 * Prefer AviationStack gates, then AeroDataBox (commute-merged row is AS ?? ADB per field when passed as fallback).
 * Source labels which provider contributed at least one displayed gate, per product rules.
 */
export function mergeLegGatesForPortal(
  aviationstack: LegGateFields | null | undefined,
  aerodatabox: LegGateFields | null | undefined
): {
  departure_gate: string | null;
  arrival_gate: string | null;
  source: "AviationStack" | "AeroDataBox" | null;
} {
  const asDep = normGate(aviationstack?.dep_gate);
  const asArr = normGate(aviationstack?.arr_gate);
  const adbDep = normGate(aerodatabox?.dep_gate);
  const adbArr = normGate(aerodatabox?.arr_gate);
  const departure_gate = asDep ?? adbDep ?? null;
  const arrival_gate = asArr ?? adbArr ?? null;
  const source =
    asDep || asArr ? "AviationStack" : adbDep || adbArr ? "AeroDataBox" : null;
  return { departure_gate, arrival_gate, source };
}
