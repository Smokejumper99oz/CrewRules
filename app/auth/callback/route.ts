import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

/** Route Handler: session cookies must be set on the same NextResponse we return (see app/api/auth/login/route.ts). */
function createSupabaseWithResponseCookies(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, { ...(options ?? {}) });
          });
        },
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim() ?? "";
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (code) {
    const redirectUrl = new URL("/frontier/pilots/reset-password", request.url);
    const response = NextResponse.redirect(redirectUrl);
    const supabase = createSupabaseWithResponseCookies(request, response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[Auth callback] exchangeCodeForSession error:", error);
      return NextResponse.redirect(
        new URL(
          `/frontier/pilots/login?error=${encodeURIComponent(error.message)}`,
          request.url
        )
      );
    }
    return response;
  }

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

  const otpType = isRecovery ? "recovery" : isInvite ? "invite" : "email";
  const successUrl = isEmailConfirmation
    ? new URL("/frontier/pilots/login?confirmed=1", request.url)
    : new URL("/frontier/pilots/reset-password", request.url);
  const response = NextResponse.redirect(successUrl);
  const supabase = createSupabaseWithResponseCookies(request, response);

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
    return response;
  }

  // Invite and recovery both send the user to set/reset their password
  return response;
}
