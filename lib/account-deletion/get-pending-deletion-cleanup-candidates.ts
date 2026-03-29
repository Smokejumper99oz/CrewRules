import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Dry-run snapshot for account purge: eligible profiles and related row counts.
 * Server-only: uses service role. Call only from trusted server code (e.g. super-admin).
 * Does not delete, update, or call external APIs.
 */

export type PendingDeletionCleanupCounts = {
  schedule_events: number;
  ask_qa: number;
  commute_cache: number;
  inbound_events: number;
  inbound_aliases: number;
};

export type PendingDeletionCleanupCandidate = {
  user_id: string;
  email: string | null;
  scheduled_for: string;
  counts: PendingDeletionCleanupCounts;
};

async function countRowsForUser(
  admin: SupabaseClient,
  table: string,
  userId: string
): Promise<number> {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`count ${table} for ${userId}: ${error.message}`);
  }
  return count ?? 0;
}

/**
 * Profiles with `deletion_scheduled_for <= now()` plus related data counts (inspection only).
 *
 * Query (profiles):
 * - `deletion_scheduled_for` is not null
 * - `deletion_scheduled_for` <= current timestamp (ISO)
 */
export async function getPendingDeletionCleanupCandidates(): Promise<PendingDeletionCleanupCandidate[]> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: rows, error: profilesError } = await admin
    .from("profiles")
    .select("id, email, deletion_scheduled_for")
    .not("deletion_scheduled_for", "is", null)
    .lte("deletion_scheduled_for", nowIso);

  if (profilesError) {
    throw new Error(`profiles: ${profilesError.message}`);
  }

  const profiles = rows ?? [];
  const results: PendingDeletionCleanupCandidate[] = [];

  for (const row of profiles) {
    const userId = row.id as string;
    const scheduled = row.deletion_scheduled_for as string | null;
    if (!scheduled) continue;

    const [
      schedule_events,
      ask_qa,
      commute_cache,
      inbound_events,
      inbound_aliases,
    ] = await Promise.all([
      countRowsForUser(admin, "schedule_events", userId),
      countRowsForUser(admin, "ask_qa", userId),
      countRowsForUser(admin, "commute_flight_cache", userId),
      countRowsForUser(admin, "inbound_email_events", userId),
      countRowsForUser(admin, "inbound_email_aliases", userId),
    ]);

    results.push({
      user_id: userId,
      email: (row.email as string | null) ?? null,
      scheduled_for: scheduled,
      counts: {
        schedule_events,
        ask_qa,
        commute_cache,
        inbound_events,
        inbound_aliases,
      },
    });
  }

  results.sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
  return results;
}
