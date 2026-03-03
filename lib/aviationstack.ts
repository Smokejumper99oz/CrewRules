/**
 * AviationStack API client for flight data.
 * @see https://aviationstack.com/documentation
 */

export type CommuteFlight = {
  carrier: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  origin: string;
  destination: string;
  durationMinutes: number;
};

function calculateDurationMinutes(dep: string, arr: string) {
  const departure = new Date(dep).getTime();
  const arrival = new Date(arr).getTime();
  return Math.max(0, Math.round((arrival - departure) / 60000));
}

const devCache = new Map<string, { expiresAt: number; data: CommuteFlight[] }>();

export async function fetchFlightsFromAviationStack(
  origin: string,
  destination: string,
  date: string,
  opts?: { noCache?: boolean }
): Promise<CommuteFlight[]> {
  const apiKey = process.env.AVIATIONSTACK_API_KEY;

  if (!apiKey) {
    throw new Error("Missing AVIATIONSTACK_API_KEY");
  }

  const key = `${origin.toUpperCase()}-${destination.toUpperCase()}-${date}`;
  // 10-minute cache for local/dev to avoid burning requests
  if (process.env.NODE_ENV !== "production" && !opts?.noCache) {
    const cached = devCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  const url = new URL("http://api.aviationstack.com/v1/timetable");
  url.searchParams.set("access_key", apiKey);
  url.searchParams.set("iataCode", origin);     // e.g., TPA
  url.searchParams.set("type", "departure");   // departures from origin (today)

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: {
      "User-Agent": "CrewRules/1.0 (CommuteAssist)",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AviationStack request failed: ${res.status} - ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  console.log("AviationStack keys:", Object.keys(json));
  console.log("AviationStack sample:", JSON.stringify(json?.data?.[0] ?? null, null, 2));
  console.log("Timetable total:", json?.data?.length ?? 0);
  console.log("Timetable sample:", JSON.stringify(json?.data?.[0] ?? null, null, 2));

  if (!json.data) return [];

  const flights: CommuteFlight[] = (json.data as any[])
    .filter((f) => {
      const arr = (f?.arrival?.iataCode ?? "").toUpperCase();
      return arr === destination.toUpperCase(); // SJU match
    })
    .map((f) => {
      const depTime = f?.departure?.scheduledTime ?? "";
      const arrTime = f?.arrival?.scheduledTime ?? "";

      const carrier = (f?.airline?.iataCode ?? "").toUpperCase();
      const number = f?.flight?.number ?? "";
      const flightNumber = carrier && number ? `${carrier}${number}` : "";

      return {
        carrier,
        flightNumber,
        departureTime: depTime,
        arrivalTime: arrTime,
        origin: (f?.departure?.iataCode ?? origin).toUpperCase(),
        destination: (f?.arrival?.iataCode ?? destination).toUpperCase(),
        durationMinutes: depTime && arrTime ? calculateDurationMinutes(depTime, arrTime) : 0,
      };
    })
    .sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime());

  if (process.env.NODE_ENV !== "production" && !opts?.noCache) {
    devCache.set(key, { expiresAt: Date.now() + 10 * 60 * 1000, data: flights });
  }

  return flights;
}
