import { createAdminClient } from "@/lib/supabase/admin";

type SystemEventType = "system" | "import" | "provider";
type SystemEventSeverity = "info" | "warning" | "error";

/**
 * Log a system event for Super Admin Needs Attention.
 * Server-only. Safe to call from API routes, cron, etc.
 */
export async function logSystemEvent(params: {
  type: SystemEventType;
  severity: SystemEventSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("system_events").insert({
      type: params.type,
      severity: params.severity,
      title: params.title,
      message: params.message,
      metadata: params.metadata ?? null,
    });
  } catch (err) {
    console.error("[system-events] insert failed:", err);
  }
}
