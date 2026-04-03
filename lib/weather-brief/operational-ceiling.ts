/**
 * Lowest operational ceiling (feet) from structured AWC cloud layers.
 * For risk heuristics only — not for pilot display strings.
 * Client-safe (pure, no I/O).
 */

export type CloudLayerInput = { cover?: string; base?: number | null };

/** BKN, OVC, vertical visibility (VV), and obscured (OVX) drive ceiling; FEW/SCT do not. */
const CEILING_DRIVING_COVERS = new Set(["BKN", "OVC", "VV", "OVX"]);

/**
 * @returns lowest base height in feet among ceiling-driving layers, or null if none qualify.
 */
export function lowestOperationalCeilingFt(
  clouds: CloudLayerInput[] | null | undefined
): number | null {
  if (!clouds?.length) return null;
  let lowest: number | null = null;
  for (const layer of clouds) {
    const cover = (layer.cover ?? "").trim().toUpperCase();
    if (!CEILING_DRIVING_COVERS.has(cover)) continue;
    const b = layer.base;
    if (b == null || typeof b !== "number" || !Number.isFinite(b) || b < 0) continue;
    const ft = Math.round(b);
    if (lowest === null || ft < lowest) lowest = ft;
  }
  return lowest;
}
