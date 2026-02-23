"use server";

import { supabase } from "@/lib/supabase";

export async function submitAccessRequest(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const email = formData.get("email") as string;
  const airline = formData.get("airline") as string | null;

  if (!email?.trim()) {
    return { error: "Email is required" };
  }

  try {
    const { error } = await supabase.from("access_requests").insert({
      email: email.trim(),
      airline: airline?.trim() || null,
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
    console.error("Request failed:", err);
    if (message.includes("fetch failed")) {
      return {
        error:
          "Could not reach the server. Check that Supabase URL and API key are set in Vercel (Settings → Environment Variables), and that your Supabase project is not paused.",
      };
    }
    return { error: message };
  }
}
