import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Finalizes a single purge-eligible account after the grace period.
 *
 * **Trusted server-only:** uses service role and `auth.admin.deleteUser`.
 * Call only from gated super-admin/cron code. Does not touch Stripe or usage tables
 * (`flightaware_usage`, `aviationstack_usage`).
 *
 * Writes to `account_deletion_log` for every attempt (after non-empty userId).
 */

/** Log row `status` values (see migration 089_account_deletion_log.sql). */
export type AccountDeletionLogStatus = "in_progress" | "success" | "failed";

export type FinalizePendingAccountDeletionResult = {
  success: boolean;
  user_id: string;
  deleted_auth_user: boolean;
  deleted_counts: {
    commute_cache: number;
    commute_refresh_usage_monthly: number;
    inbound_aliases: number;
    inbound_events: number;
  };
  error?: string;
};

const EMPTY_COUNTS: FinalizePendingAccountDeletionResult["deleted_counts"] = {
  commute_cache: 0,
  commute_refresh_usage_monthly: 0,
  inbound_aliases: 0,
  inbound_events: 0,
};

async function deleteAllRowsForUser(
  admin: SupabaseClient,
  table: string,
  userId: string
): Promise<number> {
  const { count, error: countErr } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countErr) {
    throw new Error(`${table} count: ${countErr.message}`);
  }

  const n = count ?? 0;
  if (n === 0) return 0;

  const { error: delErr } = await admin.from(table).delete().eq("user_id", userId);
  if (delErr) {
    throw new Error(`${table} delete: ${delErr.message}`);
  }

  return n;
}

function countsToLogColumns(counts: FinalizePendingAccountDeletionResult["deleted_counts"]) {
  return {
    deleted_commute_cache_count: counts.commute_cache,
    deleted_commute_refresh_usage_monthly_count: counts.commute_refresh_usage_monthly,
    deleted_inbound_aliases_count: counts.inbound_aliases,
    deleted_inbound_events_count: counts.inbound_events,
  };
}

async function finalizeDeletionLog(
  admin: SupabaseClient,
  logId: string,
  patch: {
    status: AccountDeletionLogStatus;
    completed_at?: string | null;
    error?: string | null;
    deleted_auth_user?: boolean;
    deleted_counts?: FinalizePendingAccountDeletionResult["deleted_counts"];
    email?: string | null;
    scheduled_for?: string | null;
    deletion_reason?: string | null;
  }
) {
  const { deleted_counts, ...rest } = patch;
  const payload: Record<string, unknown> = {
    status: rest.status,
    error: rest.error ?? null,
    deleted_auth_user: rest.deleted_auth_user ?? false,
    completed_at: rest.completed_at ?? null,
  };
  if (rest.email !== undefined) payload.email = rest.email;
  if (rest.scheduled_for !== undefined) payload.scheduled_for = rest.scheduled_for;
  if (rest.deletion_reason !== undefined) payload.deletion_reason = rest.deletion_reason;
  if (deleted_counts) {
    Object.assign(payload, countsToLogColumns(deleted_counts));
  }

  const { error } = await admin.from("account_deletion_log").update(payload).eq("id", logId);
  if (error) {
    console.error("[finalizePendingAccountDeletion] account_deletion_log update failed:", error.message);
  }
}

/**
 * Eligibility (all required):
 * - Profile row exists for `userId`
 * - `deletion_scheduled_for` IS NOT NULL
 * - `deletion_scheduled_for` <= current time (UTC)
 */
export async function finalizePendingAccountDeletion(
  userId: string
): Promise<FinalizePendingAccountDeletionResult> {
  const id = userId.trim();
  if (!id) {
    return {
      success: false,
      user_id: userId,
      deleted_auth_user: false,
      deleted_counts: { ...EMPTY_COUNTS },
      error: "userId is required",
    };
  }

  const admin = createAdminClient();
  const now = new Date();

  const { data: logRow, error: logInsertErr } = await admin
    .from("account_deletion_log")
    .insert({
      user_id: id,
      status: "in_progress" satisfies AccountDeletionLogStatus,
    })
    .select("id")
    .single();

  if (logInsertErr || !logRow?.id) {
    return {
      success: false,
      user_id: id,
      deleted_auth_user: false,
      deleted_counts: { ...EMPTY_COUNTS },
      error: `account_deletion_log insert: ${logInsertErr?.message ?? "no id"}`,
    };
  }

  const logId = logRow.id as string;
  const completedAt = () => new Date().toISOString();

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id, email, deletion_scheduled_for, deletion_reason")
    .eq("id", id)
    .maybeSingle();

  if (profileErr) {
    const msg = `profile load: ${profileErr.message}`;
    await finalizeDeletionLog(admin, logId, {
      status: "failed",
      completed_at: completedAt(),
      error: msg,
      deleted_counts: { ...EMPTY_COUNTS },
    });
    return {
      success: false,
      user_id: id,
      deleted_auth_user: false,
      deleted_counts: { ...EMPTY_COUNTS },
      error: msg,
    };
  }

  if (profile) {
    const reasonRaw = profile.deletion_reason as string | null | undefined;
    const reasonSnap =
      reasonRaw != null && String(reasonRaw).trim() !== "" ? String(reasonRaw).trim() : null;
    await finalizeDeletionLog(admin, logId, {
      status: "in_progress",
      email: (profile.email as string | null) ?? null,
      scheduled_for: (profile.deletion_scheduled_for as string | null) ?? null,
      deletion_reason: reasonSnap,
    });
  }

  if (!profile) {
    const msg = "Profile not found";
    await finalizeDeletionLog(admin, logId, {
      status: "failed",
      completed_at: completedAt(),
      error: msg,
      deleted_counts: { ...EMPTY_COUNTS },
    });
    return {
      success: false,
      user_id: id,
      deleted_auth_user: false,
      deleted_counts: { ...EMPTY_COUNTS },
      error: msg,
    };
  }

  const scheduledForRaw = profile.deletion_scheduled_for as string | null;
  if (scheduledForRaw == null || String(scheduledForRaw).trim() === "") {
    const msg = "Account is not scheduled for deletion (deletion_scheduled_for is null)";
    await finalizeDeletionLog(admin, logId, {
      status: "failed",
      completed_at: completedAt(),
      error: msg,
      deleted_counts: { ...EMPTY_COUNTS },
    });
    return {
      success: false,
      user_id: id,
      deleted_auth_user: false,
      deleted_counts: { ...EMPTY_COUNTS },
      error: msg,
    };
  }

  const scheduledFor = new Date(scheduledForRaw);
  if (Number.isNaN(scheduledFor.getTime())) {
    const msg = "Invalid deletion_scheduled_for timestamp";
    await finalizeDeletionLog(admin, logId, {
      status: "failed",
      completed_at: completedAt(),
      error: msg,
      deleted_counts: { ...EMPTY_COUNTS },
    });
    return {
      success: false,
      user_id: id,
      deleted_auth_user: false,
      deleted_counts: { ...EMPTY_COUNTS },
      error: msg,
    };
  }

  if (scheduledFor > now) {
    const msg = "Grace period not expired (deletion_scheduled_for is in the future)";
    await finalizeDeletionLog(admin, logId, {
      status: "failed",
      completed_at: completedAt(),
      error: msg,
      deleted_counts: { ...EMPTY_COUNTS },
    });
    return {
      success: false,
      user_id: id,
      deleted_auth_user: false,
      deleted_counts: { ...EMPTY_COUNTS },
      error: msg,
    };
  }

  const deleted_counts: FinalizePendingAccountDeletionResult["deleted_counts"] = {
    ...EMPTY_COUNTS,
  };

  try {
    deleted_counts.commute_cache = await deleteAllRowsForUser(admin, "commute_flight_cache", id);
    deleted_counts.commute_refresh_usage_monthly = await deleteAllRowsForUser(
      admin,
      "commute_refresh_usage_monthly",
      id
    );
    deleted_counts.inbound_aliases = await deleteAllRowsForUser(admin, "inbound_email_aliases", id);
    deleted_counts.inbound_events = await deleteAllRowsForUser(admin, "inbound_email_events", id);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Manual cleanup failed";
    await finalizeDeletionLog(admin, logId, {
      status: "failed",
      completed_at: completedAt(),
      error: message,
      deleted_counts,
    });
    return {
      success: false,
      user_id: id,
      deleted_auth_user: false,
      deleted_counts,
      error: message,
    };
  }

  const { error: authErr } = await admin.auth.admin.deleteUser(id);

  if (authErr) {
    const message = `auth deleteUser: ${authErr.message}`;
    await finalizeDeletionLog(admin, logId, {
      status: "failed",
      completed_at: completedAt(),
      error: message,
      deleted_auth_user: false,
      deleted_counts,
    });
    return {
      success: false,
      user_id: id,
      deleted_auth_user: false,
      deleted_counts,
      error: message,
    };
  }

  await finalizeDeletionLog(admin, logId, {
    status: "success",
    completed_at: completedAt(),
    error: null,
    deleted_auth_user: true,
    deleted_counts,
  });

  return {
    success: true,
    user_id: id,
    deleted_auth_user: true,
    deleted_counts,
  };
}
