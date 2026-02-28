"use server";

import { unstable_rethrow } from "next/navigation";
import { createActionClient } from "@/lib/supabase/server-action";

export type LoginState = { error?: string; ok?: boolean } | null;

function getSupabaseEnvCheck(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url === "https://your-project-ref.supabase.co") {
    return "Supabase not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.";
  }
  return null;
}

export async function submitLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const envError = getSupabaseEnvCheck();
  if (envError) {
    return { error: envError };
  }

  try {
    const supabase = await createActionClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: error.message };
    }

    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    const message = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";

    console.error("[Login] Error:", { message, cause });

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
        return {
          error:
            "Cannot resolve Supabase host (ENOTFOUND). Try: (1) Flush DNS: ipconfig /flushdns. (2) Use different DNS (e.g. 8.8.8.8). (3) Disable VPN if on.",
        };
      }
      return {
        error:
          "Supabase unreachable. Go to supabase.com/dashboard → Restore project if paused. Or check firewall/VPN.",
      };
    }
    return { error: message };
  }
}
