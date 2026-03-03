"use server";

import { redirect } from "next/navigation";
import { createHash } from "crypto";
import { fetchFlightsFromAviationStack } from "@/lib/aviationstack";

export async function testCommuteFetch() {
  const flights = await fetchFlightsFromAviationStack("TPA", "SJU", "2026-03-03", { noCache: true });

  // tiny hash so each run is unique in the URL (avoids any caching confusion)
  const run = createHash("md5").update(String(Date.now())).digest("hex").slice(0, 6);

  redirect(`/frontier/pilots/portal/commute/test?origin=TPA&destination=SJU&run=${run}`);
}
