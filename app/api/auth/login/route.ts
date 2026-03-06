import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getSupabaseEnvCheck(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url === "https://your-project-ref.supabase.co") {
    return "Supabase not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.";
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const email = (formData.get("email") as string)?.trim();
    const password = formData.get("password") as string;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const envError = getSupabaseEnvCheck();
    if (envError) {
      return NextResponse.json({ error: envError }, { status: 500 });
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";

    console.error("[Login API] Error:", { message, cause });

    const causeMsg = cause || "";
    const fullErr = `${message} ${causeMsg}`.toLowerCase();
    const isNetworkError =
      message.includes("fetch failed") ||
      message.includes("Failed to fetch") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      fullErr.includes("enotfound") ||
      fullErr.includes("getaddrinfo");

    if (isNetworkError) {
      if (fullErr.includes("enotfound") || fullErr.includes("getaddrinfo")) {
        return NextResponse.json(
          {
            error:
              "Cannot resolve Supabase host (ENOTFOUND). Try: (1) Flush DNS: ipconfig /flushdns. (2) Use different DNS (e.g. 8.8.8.8). (3) Disable VPN if on.",
          },
          { status: 502 }
        );
      }
      return NextResponse.json(
        {
          error:
            "Supabase unreachable. Go to supabase.com/dashboard → Restore project if paused. Or check firewall/VPN.",
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
