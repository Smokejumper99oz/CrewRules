import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/frontier/pilots/login";

  if (!token_hash || !type) {
    return NextResponse.redirect(
      new URL("/frontier/pilots/login?error=invalid_link", request.url)
    );
  }

  const isRecovery = type === "recovery";
  const isEmailConfirmation = type === "email";

  if (!isRecovery && !isEmailConfirmation) {
    return NextResponse.redirect(
      new URL("/frontier/pilots/login?error=invalid_link", request.url)
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: isRecovery ? "recovery" : "email",
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

  return NextResponse.redirect(new URL(next, request.url));
}
