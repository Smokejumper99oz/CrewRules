"use server";

import { createClient } from "@/lib/supabase/server";
import {
  isLiveForEmailAndRole,
  getSignupRouteForEmail,
  inferAirlineFromEmail,
} from "@/lib/supported-airlines";

function getSupabaseEnvCheck(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url === "https://your-project-ref.supabase.co") {
    return "Supabase env vars missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart dev server.";
  }
  return null;
}

export async function submitAccessRequest(
  _prev: {
    error?: string;
    success?: boolean;
    airlineLive?: boolean;
    signupRoute?: string;
  } | null,
  formData: FormData
) {
  const fullName = (formData.get("full_name") as string)?.trim();
  const email = formData.get("email") as string;
  const role = (formData.get("role") as string)?.trim();
  const airline = formData.get("airline") as string | null;
  const employeeNumber = formData.get("employee_number") as string | null;

  if (!fullName || !email?.trim()) {
    return { error: "Full name and email are required" };
  }
  if (!role || (role !== "pilot" && role !== "fa")) {
    return { error: "Please select Pilot or Flight Attendant" };
  }

  const envError = getSupabaseEnvCheck();
  if (envError) {
    return { error: envError };
  }

  const trimmedEmail = email.trim();
  const requestedPortal = role === "pilot" ? "pilot" : "fa";

  if (isLiveForEmailAndRole(trimmedEmail, role)) {
    const signupRoute = getSignupRouteForEmail(trimmedEmail);
    return { success: true, airlineLive: true, signupRoute: signupRoute ?? undefined };
  }

  try {
    const supabase = await createClient();
    const inferredAirline = inferAirlineFromEmail(trimmedEmail);
    const { error } = await supabase.from("waitlist").upsert(
      {
        email: trimmedEmail,
        full_name: fullName,
        requested_portal: requestedPortal,
        airline: airline?.trim() || inferredAirline,
        source: "request_access",
        status: "pending",
      },
      { onConflict: "email", ignoreDuplicates: true }
    );

    if (error) {
      console.error("[Request Access] waitlist insert error:", error);
      return {
        error: `${error.message}${error.code ? ` (code: ${error.code})` : ""}`,
      };
    }

    return { success: true, airlineLive: false };
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
