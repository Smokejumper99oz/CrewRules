"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { generateFriendlyAliasBase } from "./generate-friendly-alias";

function getFirstAndLast(profile: { full_name?: string | null; email?: string | null }): {
  first: string;
  last: string;
} {
  const fullName = (profile.full_name ?? "").trim();
  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    const first = parts[0] ?? "";
    const last = parts.slice(1).join("") ?? "";
    return { first, last };
  }

  const local = (profile.email ?? "").split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join("") ?? "";
  return { first, last };
}

async function findAvailableAlias(
  supabase: ReturnType<typeof createAdminClient>,
  baseAlias: string,
  userId: string
): Promise<string> {
  let candidate = baseAlias;
  let n = 1;
  while (true) {
    const { data } = await supabase
      .from("inbound_email_aliases")
      .select("user_id")
      .eq("alias", candidate)
      .maybeSingle();

    if (!data) return candidate;
    if (data.user_id === userId) return candidate;
    candidate = n === 1 ? `${baseAlias}2` : `${baseAlias}${n + 1}`;
    n++;
  }
}

/**
 * Assigns a human-friendly inbound email alias for a user.
 * Loads profile, generates alias, upserts into inbound_email_aliases.
 * Uses admin client to bypass RLS for upsert.
 */
export async function assignInboundAlias(userId: string): Promise<string> {
  const supabase = createAdminClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) throw new Error("Profile not found");

  const { first, last } = getFirstAndLast(profile);
  const baseAlias = generateFriendlyAliasBase(first, last, userId);
  const alias = await findAvailableAlias(supabase, baseAlias, userId);

  const { error: upsertError } = await supabase
    .from("inbound_email_aliases")
    .upsert(
      { user_id: userId, alias, is_active: true },
      { onConflict: "user_id" }
    );

  if (upsertError) throw upsertError;

  return alias;
}
