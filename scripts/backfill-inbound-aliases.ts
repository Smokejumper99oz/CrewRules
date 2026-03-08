/**
 * One-time backfill: assign human-friendly inbound email aliases to existing users.
 * Run: npx tsx scripts/backfill-inbound-aliases.ts
 * Requires: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL in env
 */

import { createClient } from "@supabase/supabase-js";
import { generateFriendlyAliasBase } from "../lib/email/generate-friendly-alias";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

async function findAvailableAlias(baseAlias: string, excludeUserId?: string): Promise<string> {
  let candidate = baseAlias;
  let n = 1;
  while (true) {
    const { data } = await supabase
      .from("inbound_email_aliases")
      .select("user_id")
      .eq("alias", candidate)
      .maybeSingle();

    if (!data) return candidate;
    if (excludeUserId && data.user_id === excludeUserId) return candidate;
    candidate = n === 1 ? `${baseAlias}2` : `${baseAlias}${n + 1}`;
    n++;
  }
}

async function main() {
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email");

  if (profileError) {
    console.error("Failed to fetch profiles:", profileError);
    process.exit(1);
  }

  if (!profiles?.length) {
    console.log("No profiles found.");
    return;
  }

  console.log(`Backfilling aliases for ${profiles.length} users...`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const profile of profiles) {
    const { first, last } = getFirstAndLast(profile);
    const baseAlias = generateFriendlyAliasBase(first, last, profile.id);
    const alias = await findAvailableAlias(baseAlias, profile.id);

    const { data: existing } = await supabase
      .from("inbound_email_aliases")
      .select("alias")
      .eq("user_id", profile.id)
      .maybeSingle();

    if (existing) {
      if (existing.alias === alias) {
        skipped++;
        continue;
      }
    }

    const { error } = await supabase
      .from("inbound_email_aliases")
      .upsert({ user_id: profile.id, alias, is_active: true }, { onConflict: "user_id" });

    if (error) {
      console.error(`  [${profile.id}] ${alias}: ${error.message}`);
      errors++;
    } else {
      console.log(`  ${profile.email ?? profile.id} → ${alias}@import.crewrules.com`);
      updated++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
