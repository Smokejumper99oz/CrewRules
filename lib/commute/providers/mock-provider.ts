import type { CommuteFlightProvider } from "./provider";
import type { CommuteSearchParams, CommuteFlightOption, CommuteRisk } from "./types";

function computeRisk(arrUtc: string, arriveByUtc: string): CommuteRisk {
  const arr = new Date(arrUtc).getTime();
  const arriveBy = new Date(arriveByUtc).getTime();
  if (arr > arriveBy) return "not_recommended";
  if (arriveBy - arr <= 90 * 60 * 1000) return "risky";
  return "recommended";
}

function getReason(risk: CommuteRisk): string {
  switch (risk) {
    case "recommended":
      return "Good buffer before report";
    case "risky":
      return "Short rest window";
    case "not_recommended":
      return "Inside your arrival buffer";
  }
}

export class MockCommuteFlightProvider implements CommuteFlightProvider {
  async searchToBase(params: CommuteSearchParams): Promise<CommuteFlightOption[]> {
    const startMs = new Date(params.startUtc).getTime();
    const endMs = new Date(params.endUtc).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return [];

    const rawOptions: Omit<CommuteFlightOption, "risk" | "reason">[] = [
      {
        id: `mock-${startMs}-1`,
        carrier: "F9",
        flight: "123",
        depUtc: new Date(startMs + 6 * 60 * 60 * 1000).toISOString(),
        arrUtc: new Date(startMs + 9 * 60 * 60 * 1000).toISOString(),
        nonstop: true,
      },
      {
        id: `mock-${startMs}-2`,
        carrier: "F9",
        flight: "456",
        depUtc: new Date(startMs + 21 * 60 * 60 * 1000).toISOString(),
        arrUtc: new Date(startMs + 24 * 60 * 60 * 1000).toISOString(),
        nonstop: true,
      },
      {
        id: `mock-${startMs}-3`,
        carrier: "F9",
        flight: "789",
        depUtc: new Date(startMs + 23 * 60 * 60 * 1000).toISOString(),
        arrUtc: new Date(startMs + 38 * 60 * 60 * 1000).toISOString(),
        nonstop: false,
      },
      {
        id: `mock-${startMs}-4`,
        carrier: "F9",
        flight: "101",
        depUtc: new Date(startMs + 2 * 60 * 60 * 1000).toISOString(),
        arrUtc: new Date(startMs + 5 * 60 * 60 * 1000).toISOString(),
        nonstop: true,
      },
    ];

    let options = rawOptions.map((opt) => {
      const risk = computeRisk(opt.arrUtc, params.arriveByUtc);
      return {
        ...opt,
        risk,
        reason: getReason(risk),
      };
    });

    if (params.nonstopOnly) {
      options = options.filter((o) => o.nonstop);
    }

    return options;
  }
}
