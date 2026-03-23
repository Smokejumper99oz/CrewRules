import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Dedicated route for signup email confirmation (type=email).
 * Password reset continues to use /auth/callback (type=recovery).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (!token_hash || type !== "email") {
    return NextResponse.redirect(
      new URL("/frontier/pilots/login?error=invalid_link", request.url)
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: "email",
  });

  if (error) {
    console.error("[Auth confirm] verifyOtp error:", error);
    return NextResponse.redirect(
      new URL(
        `/frontier/pilots/login?error=${encodeURIComponent(error.message)}`,
        request.url
      )
    );
  }

  return NextResponse.redirect(
    new URL("/frontier/pilots/login?confirmed=1", request.url)
  );
}
