"use server";

import { createClient } from "@/lib/supabase/server";

export type SignUpState = { error?: string; success?: boolean } | null;

export async function submitSignUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/frontier/pilots/login` },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
