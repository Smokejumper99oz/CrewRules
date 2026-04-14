import { createAdminClient } from "@/lib/supabase/admin";

export type MentorEmailAcknowledgementStats = {
  sent: number;
  opened: number;
  pending: number;
  confirmedPct: number;
};

/**
 * Email acknowledgement metrics from `public.mentor_email_events` only.
 * Counts are restricted to rows with a non-null `assignment_id` (matched sends/opens).
 */
export async function getMentorEmailAcknowledgementStats(): Promise<MentorEmailAcknowledgementStats> {
  const admin = createAdminClient();

  const { count: sentCountRaw, error: sentErr } = await admin
    .from("mentor_email_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "sent")
    .not("assignment_id", "is", null);

  if (sentErr) {
    console.error("[mentor_email_ack] sent count error", sentErr);
  }

  const sent = typeof sentCountRaw === "number" ? sentCountRaw : 0;

  const { data: openedRows, error: openedErr } = await admin
    .from("mentor_email_events")
    .select("resend_email_id")
    .eq("event_type", "opened")
    .not("assignment_id", "is", null)
    .not("resend_email_id", "is", null);

  if (openedErr) {
    console.error("[mentor_email_ack] opened rows error", openedErr);
  }

  const opened =
    openedRows == null
      ? 0
      : new Set(
          openedRows
            .map((r) => (r as { resend_email_id: string | null }).resend_email_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
        ).size;

  const pending = sent - opened;
  const confirmedPct = sent === 0 ? 0 : Math.round((opened / sent) * 100);

  return { sent, opened, pending, confirmedPct };
}
