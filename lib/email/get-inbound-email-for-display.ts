import { createClient } from "@/lib/supabase/server";
import { getInboundAddress } from "./get-inbound-address";

/**
 * Returns the inbound email for display (Profile, My Schedule).
 * No Pro check. Returns null for legacy u_ aliases or when no alias exists.
 */
export async function getInboundEmailForDisplay(userId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("inbound_email_aliases")
    .select("alias")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data?.alias || data.alias.startsWith("u_")) return null;

  return getInboundAddress(data.alias);
}
