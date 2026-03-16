"use server";

import { createClient } from "@/lib/supabase/server";
import { assignInboundAlias } from "./assign-inbound-alias";

/**
 * Ensures an inbound alias exists when:
 * - User has full_name set and non-empty
 * - No active inbound_email_aliases row exists
 * Does not overwrite existing aliases. Not Pro-only.
 */
export async function ensureInboundAliasIfMissing(userId: string): Promise<void> {
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) return;
  const fullName = (profile.full_name ?? "").trim();
  if (!fullName) return;

  const { data: existing, error: existingError } = await supabase
    .from("inbound_email_aliases")
    .select("alias")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (existingError || existing?.alias) return;

  await assignInboundAlias(userId);
}
