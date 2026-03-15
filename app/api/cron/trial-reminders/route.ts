import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProTrialReminderRecipients } from "@/lib/trial-reminders/get-recipients";
import { sendProTrialReminder } from "@/lib/email/send-trial-reminder";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return authHeader === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { for7d, for3d } = await getProTrialReminderRecipients();
  const supabase = createAdminClient();

  let sent7d = 0;
  let sent3d = 0;
  let failures = 0;

  for (const r of for7d) {
    const result = await sendProTrialReminder({
      to: r.email,
      fullName: r.full_name,
      daysRemaining: r.daysRemaining,
      type: "7d",
    });
    if (result.ok) {
      const { error } = await supabase
        .from("profiles")
        .update({ pro_trial_reminder_7d_sent_at: new Date().toISOString() })
        .eq("id", r.id);
      if (error) {
        console.error("[trial-reminders] failed to mark 7d sent", { id: r.id, error });
        failures++;
      } else {
        sent7d++;
      }
    } else {
      failures++;
    }
  }

  for (const r of for3d) {
    const result = await sendProTrialReminder({
      to: r.email,
      fullName: r.full_name,
      daysRemaining: r.daysRemaining,
      type: "3d",
    });
    if (result.ok) {
      const { error } = await supabase
        .from("profiles")
        .update({ pro_trial_reminder_3d_sent_at: new Date().toISOString() })
        .eq("id", r.id);
      if (error) {
        console.error("[trial-reminders] failed to mark 3d sent", { id: r.id, error });
        failures++;
      } else {
        sent3d++;
      }
    } else {
      failures++;
    }
  }

  return NextResponse.json({
    eligible7d: for7d.length,
    sent7d,
    eligible3d: for3d.length,
    sent3d,
    failures,
  });
}
