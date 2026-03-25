import { NextResponse } from "next/server";

/**
 * Legacy cleanup route. Verification is now handled by Supabase hosted flow.
 * Any old link hitting this route is safely sent to login with confirmed=1.
 */
export async function GET(request: Request) {
  return NextResponse.redirect(
    new URL("/frontier/pilots/login?confirmed=1", request.url)
  );
}
