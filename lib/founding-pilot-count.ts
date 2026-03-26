import { createClient } from "@/lib/supabase/server";
import { FOUNDING_PILOT_CAP } from "@/lib/founding-pilot-constants";

export { FOUNDING_PILOT_CAP };

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/** Exact count of profiles with permanent Founding Pilot status (server-safe). */
export async function getFoundingPilotCount(supabaseClient?: ServerSupabase): Promise<number> {
  const supabase = supabaseClient ?? (await createClient());
  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_founding_pilot", true);
  return count ?? 0;
}
