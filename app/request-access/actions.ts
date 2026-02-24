"use server";

import { supabase } from "@/lib/supabase";

function getSupabaseEnvCheck(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url === "https://your-project-ref.supabase.co") {
    return "Supabase env vars missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart dev server.";
  }
  return null;
}

export async function submitAccessRequest(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const email = formData.get("email") as string;
  const airline = formData.get("airline") as string | null;
  const employeeNumber = formData.get("employee_number") as string | null;

  if (!email?.trim()) {
    return { error: "Email is required" };
  }

  const envError = getSupabaseEnvCheck();
  if (envError) {
    return { error: envError };
  }

  try {
    const { error } = await supabase.from("access_requests").insert({
      email: email.trim(),
      airline: airline?.trim() || null,
      employee_number: employeeNumber?.trim() || null,
    });

    if (error) {
      console.error("Supabase error:", error);
      return {
        error: `${error.message}${error.code ? ` (code: ${error.code})` : ""}`,
      };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";

    // Log full details to server terminal (check where you run npm run dev)
    console.error("[Request Access] Full error:", {
      message,
      cause,
      name: err instanceof Error ? err.name : "unknown",
      stack: err instanceof Error ? err.stack : undefined,
    });

    const isNetworkError =
      message.includes("fetch failed") ||
      message.includes("Failed to fetch") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      cause.includes("fetch failed") ||
      cause.includes("ECONNREFUSED") ||
      message.toLowerCase().includes("network");

    if (isNetworkError) {
      return {
        error:
          "Could not reach Supabase. See terminal (where npm run dev runs) for details. Check: (1) Restart dev server. (2) Supabase Dashboard → project not paused. (3) .env.local has correct NEXT_PUBLIC_SUPABASE_URL.",
      };
    }
    return { error: message };
  }
}
