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

  const { error } = await supabase.from("access_requests").insert({
    email: email.trim(),
    airline: airline?.trim() || null,
  });

  if (error) {
    console.error(error);
    return { error: "Something went wrong. Please try again." };
  }

  return { success: true };
}
