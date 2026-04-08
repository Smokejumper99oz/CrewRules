import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (!token_hash || !type) {
    return NextResponse.redirect(
      new URL("/frontier/pilots/login?error=invalid_link", request.url)
    );
  }

  const isRecovery = type === "recovery";
  const isEmailConfirmation = type === "email";
  // invite / signup types are used by Supabase's inviteUserByEmail
  const isInvite = type === "invite" || type === "signup";

  if (!isRecovery && !isEmailConfirmation && !isInvite) {
    return NextResponse.redirect(
      new URL("/frontier/pilots/login?error=invalid_link", request.url)
    );
  }

  const supabase = await createClient();
  const otpType = isRecovery ? "recovery" : isInvite ? "invite" : "email";
  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: otpType,
  });

  if (error) {
    console.error("[Auth callback] verifyOtp error:", error);
    return NextResponse.redirect(
      new URL(
        `/frontier/pilots/login?error=${encodeURIComponent(error.message)}`,
        request.url
      )
    );
  }

  if (isEmailConfirmation) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        const admin = createAdminClient();
        await admin
          .from("pending_signups")
          .update({ confirmed_at: new Date().toISOString() })
          .eq("user_id", user.id);
      }
    } catch (pendingErr) {
      console.warn("[Auth callback] pending_signups confirmed_at update failed:", pendingErr);
    }
    return NextResponse.redirect(
      new URL("/frontier/pilots/login?confirmed=1", request.url)
    );
  }

  // Invite and recovery both send the user to set/reset their password
  return NextResponse.redirect(
    new URL("/frontier/pilots/reset-password", request.url)
  );
}
