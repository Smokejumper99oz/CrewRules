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
};
