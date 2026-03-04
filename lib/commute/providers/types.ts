export type CommuteRisk = "recommended" | "risky" | "not_recommended";

export type CommuteSearchParams = {
  tenant: string;
  portal: string;
  fromAirport: string;
  toAirport: string;
  startUtc: string;
  endUtc: string;
  nonstopOnly: boolean;
  arrivalBufferMinutes: number;
  arriveByUtc: string;
  baseTimezone: string;
};

export type CommuteFlightOption = {
  id: string;
  carrier: string;
  flight?: string;
  depUtc: string;
  arrUtc: string;
  nonstop: boolean;
  risk: CommuteRisk;
  reason: string;
  /** IANA timezone for departure airport (for correct time display). */
  originTz?: string;
  /** IANA timezone for arrival airport (for correct time display). */
  destTz?: string;
  /** Live timing from /v1/flights (for delay Was/Now display). */
  dep_scheduled_raw?: string;
  dep_estimated_raw?: string;
  dep_actual_raw?: string;
  dep_delay_min?: number | null;
  arr_scheduled_raw?: string;
  arr_estimated_raw?: string;
  arr_actual_raw?: string;
  arr_delay_min?: number | null;
  status?: string;
};
