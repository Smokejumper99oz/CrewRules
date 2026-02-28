"use server";

import { createClient } from "@/lib/supabase/server";

export type ResetPasswordState = { error?: string; success?: boolean } | null;

export async function updatePassword(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = formData.get("password") as string;
  const confirm = formData.get("confirm") as string;

  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match" };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Session expired. Please request a new reset link." };
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return { error: error.message };
    }

    await supabase.auth.signOut();

    return { success: true };
  } catch (err) {
    console.error("[ResetPassword] Error:", err);
    return { error: "Failed to update password. Please try again." };
  }
}
