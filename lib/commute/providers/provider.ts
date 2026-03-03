import type { CommuteSearchParams, CommuteFlightOption } from "./types";
import { MockCommuteFlightProvider } from "./mock-provider";

export interface CommuteFlightProvider {
  searchToBase(params: CommuteSearchParams): Promise<CommuteFlightOption[]>;
}

export function getCommuteFlightProvider(_tenant: string, _portal: string): CommuteFlightProvider {
  return new MockCommuteFlightProvider();
}
