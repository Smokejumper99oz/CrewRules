/**
 * DEV-ONLY: Clear imported schedule rows for a single user.
 * Use to reset stale muted/old-batch rows before re-importing.
 *
 * Run: USER_ID=<your-uuid> npm run clear-schedule:dev
 * Or:  USER_ID=<your-uuid> npx tsx scripts/clear-schedule-dev.ts
 *
 * Loads .env.local automatically (if dotenv installed). Otherwise set env manually.
 * Requires: USER_ID, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Safety: Only runs when NODE_ENV=development
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { createClient } from "@supabase/supabase-js";

const FLICA_SOURCE = "flica_import";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const userId = process.env.USER_ID?.trim();

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!userId) {
  console.error("Missing USER_ID. Run: USER_ID=<your-uuid> npx tsx scripts/clear-schedule-dev.ts");
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run in production. Set NODE_ENV=development");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. Count schedule_events before
  const { count: beforeCount, error: countErr } = await supabase
    .from("schedule_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", FLICA_SOURCE);

  if (countErr) {
    console.error("Failed to count schedule_events:", countErr);
    process.exit(1);
  }

  // 2. Count muted rows before
  const { data: mutedRows } = await supabase
    .from("schedule_events")
    .select("id")
    .eq("user_id", userId)
    .eq("source", FLICA_SOURCE)
    .eq("is_muted", true);

  const mutedCount = mutedRows?.length ?? 0;

  console.log("--- Before delete ---");
  console.log("Table: schedule_events");
  console.log("Filter: user_id =", userId, "AND source =", FLICA_SOURCE);
  console.log("Total rows:", beforeCount ?? 0);
  console.log("Muted rows:", mutedCount);

  if ((beforeCount ?? 0) === 0) {
    console.log("\nNo rows to delete. Already empty.");
    return;
  }

  // 3. Delete schedule_events
  const { error: deleteErr } = await supabase
    .from("schedule_events")
    .delete()
    .eq("user_id", userId)
    .eq("source", FLICA_SOURCE);

  if (deleteErr) {
    console.error("Failed to delete schedule_events:", deleteErr);
    process.exit(1);
  }

  // 4. Delete trip_change_summaries for this user
  const { error: tcsErr } = await supabase
    .from("trip_change_summaries")
    .delete()
    .eq("user_id", userId);

  if (tcsErr) {
    console.error("Warning: trip_change_summaries delete failed:", tcsErr);
  }

  // 5. Confirm count is 0
  const { count: afterCount, error: afterErr } = await supabase
    .from("schedule_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", FLICA_SOURCE);

  if (afterErr) {
    console.error("Failed to verify count:", afterErr);
    process.exit(1);
  }

  console.log("\n--- After delete ---");
  console.log("schedule_events rows:", afterCount ?? 0);

  if ((afterCount ?? 0) !== 0) {
    console.error("Expected 0 rows. Delete may have failed.");
    process.exit(1);
  }

  console.log("\nDone. You can now re-import February and March schedules.");
}

main();
