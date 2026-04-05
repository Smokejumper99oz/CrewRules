/**
 * Client-safe commute coverage types and copy (no server / DB imports).
 */

export type CommuteCoverageReasonCode =
  | "single_provider"
  | "low_flight_count"
  | "no_live_fields_same_day";

export type CommuteCoverageForClient = {
  coverageWarning: boolean;
  coverageWarningReasons: CommuteCoverageReasonCode[];
  coverageWarningTitle: string;
  coverageWarningMessage: string;
};

export const COMMUTE_COVERAGE_UI_TITLE = "Coverage may be incomplete";

export const COMMUTE_COVERAGE_UI_MESSAGE =
  "Flight results look lighter than expected for this route/date. Double-check later options before making a commute decision.";
