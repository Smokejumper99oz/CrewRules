import { createAdminClient } from "@/lib/supabase/admin";

export type SystemEventSeverity = "info" | "warning" | "error";
export type SystemEventType = "import" | "provider" | "mentoring" | "error" | "system";

export interface PostSystemEventOptions {
  /** Stable dedup key — same id won't create a duplicate row (uses upsert). */
  id?: string;
  type?: SystemEventType;
  severity?: SystemEventSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Write a message to the Super Admin "Needs Attention" box.
 * Safe to call from any server-side context (API routes, server actions, server components).
 * Uses upsert so repeated calls with the same `id` are idempotent — no spam.
 */
export async function postSystemEvent(opts: PostSystemEventOptions): Promise<void> {
  const admin = createAdminClient();

  const row = {
    id: opts.id ?? crypto.randomUUID(),
    type: opts.type ?? "system",
    severity: opts.severity ?? "warning",
    title: opts.title,
    message: opts.message,
    metadata: opts.metadata ?? null,
    dismissed: false,
  };

  const { error } = await admin
    .from("system_events")
    .upsert(row, { onConflict: "id", ignoreDuplicates: true });

  if (error) {
    console.error("[postSystemEvent] failed to write system event:", error.message, row);
  } else {
    console.log("[postSystemEvent] system event posted:", row.title);
  }
}
