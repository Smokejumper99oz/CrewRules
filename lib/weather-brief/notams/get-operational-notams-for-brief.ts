import { resolveStationCode } from "@/lib/weather-brief/resolve-station-code";

import { decodeOperationalNotamItems } from "@/lib/ai/notam-decode";



import { fetchAvwxOperationalNotamsBrief } from "./providers/avwx-notam-provider";

import type { OperationalNotamItem, OperationalNotamsBriefResult, OperationalNotamDecodedOverlay } from "./types";



function normalizeNotamProviderEnv(): string {

  return (process.env.NOTAM_PROVIDER ?? "").trim().toLowerCase();

}



/** True when NOTAM ingestion is deliberately off or unset (Basic stub / awaiting credentials). */

function isNotamProviderDisabled(): boolean {

  const p = normalizeNotamProviderEnv();

  return !p || p === "disabled";

}



function shouldUseAvwxEnterprise(): boolean {

  return normalizeNotamProviderEnv() === "avwx" && !!process.env.AVWX_API_KEY?.trim();

}



function attachDecodeOverlays(

  brief: OperationalNotamsBriefResult,

  overlays: Map<string, OperationalNotamDecodedOverlay>

): OperationalNotamsBriefResult {

  const mapItem = (it: OperationalNotamItem): OperationalNotamItem => ({

    ...it,

    decoded:

      overlays.get(it.id) ??

      ({ decodeStatus: "error" as const, decodeErrorBrief: "Decode overlay missing." } satisfies OperationalNotamDecodedOverlay),

  });



  return {

    ...brief,

    departure: { ...brief.departure, items: brief.departure.items.map(mapItem) },

    arrival: { ...brief.arrival, items: brief.arrival.items.map(mapItem) },

  };

}



/**

 * Runs optional OpenAI batch decode server-side — never affects availability flags from AVWX.

 */

async function withOperationalNotamDecodes(brief: OperationalNotamsBriefResult): Promise<OperationalNotamsBriefResult> {

  if (brief.availability !== "ok") return brief;

  const merged = [...brief.departure.items, ...brief.arrival.items];

  if (merged.length === 0) return brief;



  try {

    const overlays = await decodeOperationalNotamItems(merged);

    return attachDecodeOverlays(brief, overlays);

  } catch (err) {

    console.warn("[weather-brief] NOTAM decode merge failed:", err instanceof Error ? err.message.slice(0, 200) : err);

    return brief;

  }

}



export async function getOperationalNotamsForBrief(

  departureAirport: string,

  arrivalAirport: string

): Promise<OperationalNotamsBriefResult> {

  const departureStationIcao = resolveStationCode(departureAirport ?? "").trim().toUpperCase();

  const arrivalStationIcao = resolveStationCode(arrivalAirport ?? "").trim().toUpperCase();

  const fetchedAt = new Date().toISOString();



  const unavailableNotConfigured = (): OperationalNotamsBriefResult => ({

    availability: "unavailable",

    reason: "not_configured",

    departure: { stationIcao: departureStationIcao, items: [] },

    arrival: { stationIcao: arrivalStationIcao, items: [] },

    fetchedAt,

  });



  if (isNotamProviderDisabled()) {

    return unavailableNotConfigured();

  }



  if (shouldUseAvwxEnterprise()) {

    try {

      const rawBrief = await fetchAvwxOperationalNotamsBrief(departureStationIcao, arrivalStationIcao);

      return await withOperationalNotamDecodes(rawBrief);

    } catch {

      return {

        availability: "unavailable",

        reason: "provider_error",

        departure: { stationIcao: departureStationIcao, items: [] },

        arrival: { stationIcao: arrivalStationIcao, items: [] },

        fetchedAt: new Date().toISOString(),

      };

    }

  }



  return unavailableNotConfigured();

}

