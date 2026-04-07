import { createAdminClient } from "@/lib/supabase/admin";
import { FOUNDING_PILOT_CAP } from "@/lib/founding-pilot-constants";

export { FOUNDING_PILOT_CAP };

/** Exact count of profiles with permanent Founding Pilot status.
 *  Uses the admin client to bypass RLS — regular users can only see their own
 *  profile row, so a user-scoped query would always return 0 or 1.
 */
export async function getFoundingPilotCount(): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_founding_pilot", true);
  return count ?? 0;
}
