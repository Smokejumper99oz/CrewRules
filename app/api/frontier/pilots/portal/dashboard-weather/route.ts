import { NextResponse } from "next/server";
import { resolvePortalAccess } from "@/lib/portal-gate";
import { getHomeBaseMetar } from "@/lib/weather-brief/get-home-base-metar";
import { resolveNearestNwsMetarStationIcao } from "@/lib/weather-brief/nearest-nws-metar-station";

/** Same tenant/portal as `app/frontier/pilots/portal/layout.tsx`. */
const PORTAL_TENANT = "frontier";
const PORTAL = "pilots";

type Body = { lat?: unknown; lng?: unknown };

function parseCoord(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const access = await resolvePortalAccess(PORTAL_TENANT, PORTAL);
    if (!access.ok) {
      if (access.code === "not_signed_in") {
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const lat = parseCoord(body.lat);
    const lng = parseCoord(body.lng);
    if (lat == null || lng == null) {
      return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "coordinates out of range" }, { status: 400 });
    }

    const icao = await resolveNearestNwsMetarStationIcao(lat, lng);
    if (!icao) {
      return NextResponse.json({ metar: null });
    }

    const metar = await getHomeBaseMetar(icao).catch(() => null);
    return NextResponse.json({ metar });
  } catch (e) {
    console.error("[dashboard-weather]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
