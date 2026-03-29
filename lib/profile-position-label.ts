export type ProfilePosition = "captain" | "first_officer" | "flight_attendant";

/** Captain / First Officer / Flight Attendant from profile Position; null if unset. Safe for Client Components (no server imports). */
export function getProfilePositionLabel(position: ProfilePosition | null | undefined): string | null {
  if (position === "captain") return "Captain";
  if (position === "first_officer") return "First Officer";
  if (position === "flight_attendant") return "Flight Attendant";
  return null;
}
