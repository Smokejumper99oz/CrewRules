import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/system-events";
import { sendSignupFollowupEmail } from "@/lib/email/send-signup-followup";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return authHeader === `Bearer ${expected}`;
}

type PendingRow = {
  user_id: string;
  signup_at: string;
  email_normalized: string | null;
  alert_10m_at: string | null;
  followup_email_at: string | null;
};

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowMs = Date.now();
  const tenMinCutoffIso = new Date(nowMs - 10 * 60 * 1000).toISOString();
  const twoHourCutoffIso = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString();

  const { data: pendingRows, error: fetchError } = await admin
    .from("pending_signups")
    .select("user_id, signup_at, email_normalized, alert_10m_at, followup_email_at")
    .is("confirmed_at", null);

  if (fetchError) {
    console.error("[signup-nudge] fetch pending_signups:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  let confirmedSync = 0;
  let alertsSent = 0;
  let followupsSent = 0;
  let errors = 0;

  for (const row of (pendingRows ?? []) as PendingRow[]) {
    try {
      const { data: authData, error: authErr } = await admin.auth.admin.getUserById(row.user_id);
      if (authErr) {
        console.error("[signup-nudge] getUserById", row.user_id, authErr.message);
        errors++;
        continue;
      }

      if (authData.user?.email_confirmed_at) {
        const { error: upErr } = await admin
          .from("pending_signups")
          .update({ confirmed_at: new Date().toISOString() })
          .eq("user_id", row.user_id)
          .is("confirmed_at", null);
        if (!upErr) confirmedSync++;
        continue;
      }

      const signupAtMs = new Date(row.signup_at).getTime();
      if (Number.isNaN(signupAtMs)) continue;

      if (signupAtMs <= nowMs - 10 * 60 * 1000) {
        const claimAt = new Date().toISOString();
        const { data: alertClaimed, error: alertClaimErr } = await admin
          .from("pending_signups")
          .update({ alert_10m_at: claimAt })
          .eq("user_id", row.user_id)
          .is("confirmed_at", null)
          .is("alert_10m_at", null)
          .lte("signup_at", tenMinCutoffIso)
          .select("user_id, email_normalized")
          .maybeSingle();

        if (alertClaimErr) {
          console.error("[signup-nudge] alert claim", alertClaimErr.message);
          errors++;
        } else if (alertClaimed) {
          await logSystemEvent({
            type: "system",
            severity: "warning",
            title: "Unconfirmed signup",
            message: "User has not confirmed signup after 10 minutes",
            metadata: {
              user_id: row.user_id,
              email: row.email_normalized ?? undefined,
            },
          });
          alertsSent++;
        }
      }

      if (signupAtMs <= nowMs - 2 * 60 * 60 * 1000 && row.email_normalized?.trim()) {
        const emailClaimAt = new Date().toISOString();
        const { data: emailClaimed, error: emailClaimErr } = await admin
          .from("pending_signups")
          .update({ followup_email_at: emailClaimAt })
          .eq("user_id", row.user_id)
          .is("confirmed_at", null)
          .is("followup_email_at", null)
          .lte("signup_at", twoHourCutoffIso)
          .select("user_id, email_normalized")
          .maybeSingle();

        if (emailClaimErr) {
          console.error("[signup-nudge] followup claim", emailClaimErr.message);
          errors++;
        } else if (emailClaimed?.email_normalized) {
          const result = await sendSignupFollowupEmail({
            to: emailClaimed.email_normalized.trim(),
          });
          if (result.ok) {
            followupsSent++;
          } else {
            await admin
              .from("pending_signups")
              .update({ followup_email_at: null })
              .eq("user_id", row.user_id);
            errors++;
          }
        }
      }
    } catch (loopErr) {
      console.error("[signup-nudge] row error", row.user_id, loopErr);
      errors++;
    }
  }

  return NextResponse.json({
    pendingScanned: (pendingRows ?? []).length,
    confirmedSync,
    alertsSent,
    followupsSent,
    errors,
  });
}
