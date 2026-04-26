import { NextResponse } from "next/server";

/**
 * Diagnostic endpoint: open http://localhost:3000/api/supabase-health in browser
 * Add ?raw=1 to label the response as raw-fetch mode (same check either way).
 *
 * Uses Auth /health only — does not rely on anon SELECT on any table (see migration 165).
 */
export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { searchParams } = new URL(request.url);
  const useRawFetch = searchParams.get("raw") === "1";

  if (!url || !key || url === "https://your-project-ref.supabase.co") {
    return NextResponse.json(
      {
        ok: false,
        error: "env_missing",
        detail: "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set in .env.local",
        hint: "Add both to .env.local and restart the dev server.",
      },
      { status: 500 }
    );
  }

  const baseUrl = url.replace(/\/$/, "");

  try {
    const res = await fetch(`${baseUrl}/auth/v1/health`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "supabase_error",
          detail: `HTTP ${res.status}`,
          rawFetch: useRawFetch,
          hint: "Auth service returned a non-OK status. Check project status in the Supabase dashboard.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Supabase connection OK",
      authReachable: true,
      rawFetch: useRawFetch,
      urlPrefix: url.replace(/\/$/, "").slice(0, 40) + "...",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause ? String(err.cause) : "";

    return NextResponse.json(
      {
        ok: false,
        error: useRawFetch ? "raw_fetch_failed" : "fetch_failed",
        rawFetch: useRawFetch,
        detail: message,
        cause: cause || undefined,
        hint: "Server cannot reach Supabase. Check: (1) Project not paused. (2) Correct URL in .env.local. (3) Firewall/VPN — try NODE_OPTIONS=--dns-result-order=ipv4first",
      },
      { status: 500 }
    );
  }
}
