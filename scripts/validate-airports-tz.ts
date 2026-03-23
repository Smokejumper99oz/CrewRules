/**
 * Report airports with missing or invalid timezone data.
 * Run: npx tsx scripts/validate-airports-tz.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or .env.local)
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { findAirportsWithMissingTz } from "../lib/airports-validation";

async function main() {
  const missing = await findAirportsWithMissingTz();
  if (missing.length === 0) {
    console.log("All airports have valid timezone data.");
    return;
  }
  console.log(`Airports with missing/invalid tz (${missing.length}):`);
  for (const r of missing) {
    console.log(`  ${r.iata}: tz="${r.tz ?? "(null)"}" [${r.status}]`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
