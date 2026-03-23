/**
 * Shared types and display helpers for operational status.
 * Zero runtime deps - safe for client and server.
 */

export type OperationalStatusLabel = "cancelled" | "delayed" | "on_time" | "unknown";

export type OperationalStatusSource =
  | "provider_status"
  | "dep_delay_min"
  | "arr_delay_min"
  | "timestamp_dep"
  | "timestamp_arr"
  | "proven_on_time"
  | "unknown_fallback";

export type OperationalStatus = {
  label: OperationalStatusLabel;
  delay_minutes: number | null;
  source_of_truth: OperationalStatusSource;
  confidence: "high" | "medium" | "low";
  dep?: { scheduled: string; actual: string };
  arr?: { scheduled: string; actual: string };
};

/** Map OperationalStatusLabel to display text. */
export function operationalStatusToDisplayLabel(label: OperationalStatusLabel): string {
  switch (label) {
    case "cancelled":
      return "Cancelled";
    case "delayed":
      return "Delayed";
    case "on_time":
      return "On time";
    case "unknown":
      return "Scheduled";
    default:
      return "Scheduled";
  }
}
