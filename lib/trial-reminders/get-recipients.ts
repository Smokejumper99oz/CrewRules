import { addDays } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";

export type TrialReminderRecipient = {
  id: string;
  email: string;
  full_name: string | null;
  daysRemaining: number;
};

export type TrialReminderRecipients = {
  for7d: TrialReminderRecipient[];
  for3d: TrialReminderRecipient[];
};

/**
 * Server-only. Returns profiles eligible for 7-day and 3-day Pro trial reminder emails.
 * Uses admin client to bypass RLS. Excludes paid Pro/Enterprise, expired trials, and users already sent.
 */
export async function getProTrialReminderRecipients(): Promise<TrialReminderRecipients> {
  const supabase = createAdminClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, subscription_tier, pro_trial_started_at, pro_trial_expires_at, pro_trial_reminder_7d_sent_at, pro_trial_reminder_3d_sent_at");

  if (error) {
    return { for7d: [], for3d: [] };
  }

  const now = new Date();
  const nowMs = now.getTime();
  const in3Days = addDays(now, 3).getTime();
  const in7Days = addDays(now, 7).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;

  const for7d: TrialReminderRecipient[] = [];
  const for3d: TrialReminderRecipient[] = [];

  for (const p of profiles ?? []) {
    const tier = (p.subscription_tier ?? "free") as string;
    if (tier !== "free") continue;

    const startedAt = p.pro_trial_started_at;
    const expiresAt = p.pro_trial_expires_at;
    if (!startedAt || !expiresAt) continue;

    const email = (p.email ?? "").trim();
    if (!email) continue;

    const expiresMs = new Date(expiresAt).getTime();
    if (Number.isNaN(expiresMs) || expiresMs <= nowMs) continue;

    const daysRemaining = Math.ceil((expiresMs - nowMs) / msPerDay);
    const row: TrialReminderRecipient = {
      id: p.id,
      email,
      full_name: p.full_name?.trim() || null,
      daysRemaining,
    };

    if (expiresMs <= in7Days && !p.pro_trial_reminder_7d_sent_at) {
      for7d.push(row);
    }
    if (expiresMs <= in3Days && !p.pro_trial_reminder_3d_sent_at) {
      for3d.push(row);
    }
  }

  return { for7d, for3d };
}
