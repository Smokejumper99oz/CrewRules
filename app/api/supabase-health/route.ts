import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Diagnostic endpoint: open http://localhost:3000/api/supabase-health in browser
 * Add ?raw=1 to test raw fetch (bypasses Supabase client)
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

  // Test 1: Raw fetch to Supabase REST API (isolates Node fetch vs Supabase client)
  if (useRawFetch) {
    try {
      const res = await fetch(`${baseUrl}/rest/v1/access_requests?select=id&limit=1`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      });
      return NextResponse.json({
        ok: res.ok,
        rawFetch: true,
        status: res.status,
        message: res.ok ? "Raw fetch to Supabase succeeded" : `HTTP ${res.status}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const cause = err instanceof Error && err.cause ? String(err.cause) : "";
      return NextResponse.json(
        {
          ok: false,
          rawFetch: true,
          error: "raw_fetch_failed",
          detail: msg,
          cause: cause || undefined,
          hint: "Node.js cannot reach Supabase (firewall, DNS, or SSL). Try: different network, disable VPN, or NODE_OPTIONS=--dns-result-order=ipv4first",
        },
        { status: 500 }
      );
    }
  }

  // Test 2: Supabase client
  try {
    const { data, error } = await supabase.from("access_requests").select("id").limit(1);

    if (error) {
      const msg = error.message || String(error);
      const isFetchFailed = msg.includes("fetch failed") || msg.includes("Failed to fetch");

      return NextResponse.json(
        {
          ok: false,
          error: isFetchFailed ? "connection_failed" : "supabase_error",
          detail: msg,
          code: error.code || undefined,
          hint: isFetchFailed
            ? "Server cannot reach Supabase. Most likely: (1) Project is PAUSED → go to supabase.com/dashboard and click Restore. (2) Wrong URL in .env.local. (3) Firewall/VPN blocking outbound HTTPS."
            : "Check your Supabase table and RLS policies.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Supabase connection OK",
      tableReachable: true,
      urlPrefix: url.replace(/\/$/, "").slice(0, 40) + "...",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause ? String(err.cause) : "";

    return NextResponse.json(
      {
        ok: false,
        error: "fetch_failed",
        detail: message,
        cause: cause || undefined,
        hint: "Server cannot reach Supabase. Check: (1) Supabase project not paused. (2) Correct URL in .env.local. (3) No firewall blocking outbound HTTPS.",
      },
      { status: 500 }
    );
  }
}
