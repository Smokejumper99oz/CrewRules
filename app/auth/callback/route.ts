import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/frontier/pilots/login";

  if (!token_hash || type !== "recovery") {
    return NextResponse.redirect(
      new URL("/frontier/pilots/login?error=invalid_link", request.url)
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: "recovery",
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

  return NextResponse.redirect(new URL(next, request.url));
}
