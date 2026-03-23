import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function getSupabaseEnvCheck(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url === "https://your-project-ref.supabase.co") {
    return "Supabase not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.";
  }
  return null;
}

/**
 * Detect iPhone/iPad from User-Agent for session persistence.
 * Covers iPadOS 13+ desktop-class Safari: UA reports "Macintosh" but sec-ch-ua-mobile=?1 indicates mobile.
 * Safari does not send sec-ch-ua-mobile; Chrome/Edge on iPad do. Kept minimal to avoid brittleness.
 */
function isIOSUserAgent(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  const mobileHint = request.headers.get("sec-ch-ua-mobile");
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && mobileHint === "?1")
  );
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const email = (formData.get("email") as string)?.trim();
    const password = formData.get("password") as string;
    const remember = formData.get("remember") === "on";
    const fromIOS = isIOSUserAgent(request);
    const useSessionOnlyCookies = !remember && !fromIOS;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const envError = getSupabaseEnvCheck();
    if (envError) {
      return NextResponse.json({ error: envError }, { status: 500 });
    }

    const successResponse = NextResponse.json({ ok: true });
    const cookiesForFinal: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              const opts = { ...(options ?? {}) };
              if (useSessionOnlyCookies) {
                delete opts.maxAge;
                delete opts.expires;
              }
              successResponse.cookies.set(name, value, opts);
              cookiesForFinal.push({ name, value, options: opts });
            });
          },
        },
      }
    );

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const message =
        error.message === "Invalid login credentials"
          ? "Invalid login credentials. Use Forgot User ID or Password if you already signed up, or Create account if you're new to CrewRules."
          : error.message;
      return NextResponse.json({ error: message }, { status: 401 });
    }

    // Super admin lands on /super-admin; others on portal
    const userId = signInData?.user?.id;
    let redirectTo = "/frontier/pilots/portal";
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      const emailLower = email.toLowerCase().trim();
      const isAllowlisted = ["svenfolmer92@gmail.com"].some((e) => e.toLowerCase() === emailLower);
      const isSuperAdmin = profile?.role === "super_admin" || isAllowlisted;
      if (isSuperAdmin) redirectTo = "/super-admin";
    }

    const final = NextResponse.json({ ok: true, redirect: redirectTo });
    cookiesForFinal.forEach(({ name, value, options }) => final.cookies.set(name, value, options));

    if (useSessionOnlyCookies) {
      final.cookies.set("crewrules-remember", "0", { path: "/" });
    } else {
      final.cookies.set("crewrules-remember", "1", { path: "/", maxAge: 60 * 60 * 24 * 400 });
    }
    return final;
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
