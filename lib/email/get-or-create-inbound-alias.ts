import { createClient } from "@/lib/supabase/server";
import { assignInboundAlias } from "@/lib/email/assign-inbound-alias";
import { isProActive } from "@/lib/profile";
import type { Profile } from "@/lib/profile";

export async function getOrCreateInboundAlias(userId: string) {
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("subscription_tier, pro_trial_expires_at")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!isProActive(profile as Profile | null)) {
    throw new Error("Inbound email import is a CrewRules Pro feature.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("inbound_email_aliases")
    .select("alias")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.alias) return existing.alias;

  return assignInboundAlias(userId);
}
