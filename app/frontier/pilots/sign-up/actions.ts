"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inferAirlineFromEmail } from "@/lib/supported-airlines";
import { FRONTIER_PILOT_SIGNUP_USE_AIRLINE_EMAIL } from "./constants";

export type SignUpState =
  | { error?: string; success?: boolean; email?: string; waitlist?: boolean }
  | null;

export type VerifyOtpState = { error?: string; success?: boolean } | null;

const FRONTIER_EMAIL_ERROR = "Use your Frontier company email (@flyfrontier.com).";

const COMPLETE_PROFILE_PATH = "/frontier/pilots/complete-profile";

function isValidFrontierEmail(email: string): boolean {
  const trimmed = email.trim();
  const normalized = trimmed.toLowerCase();
  return normalized.endsWith("@flyfrontier.com");
}

export async function submitSignUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const fullName = (formData.get("full_name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const employeeNumberRaw = formData.get("employee_number") as string | null;
  const employeeNumber = employeeNumberRaw != null ? String(employeeNumberRaw).trim() : "";
  const password = formData.get("password") as string;

  if (!fullName || !email || !password) {
    return { error: "Full name, email, and password are required" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  const isFrontier = isValidFrontierEmail(email);

  if (isFrontier && !employeeNumber) {
    return { error: "Employee Number is required" };
  }

  if (!isFrontier) {
    if (inferAirlineFromEmail(email) === "unknown") {
      return { error: FRONTIER_PILOT_SIGNUP_USE_AIRLINE_EMAIL };
    }

    const supabase = await createClient();
    const airline = inferAirlineFromEmail(email);
    const { error } = await supabase.from("waitlist").upsert(
      {
        email,
        full_name: fullName,
        requested_portal: "pilots",
        airline,
        source: "frontier_signup",
        status: "pending",
      },
      { onConflict: "email", ignoreDuplicates: true }
    );

    if (error) {
      console.error("[submitSignUp] waitlist insert error:", error);
      return { error: error.message };
    }

    return { waitlist: true };
  }

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const origin = `${protocol}://${host}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/frontier/pilots/login?confirmed=1`,
      data: {
        full_name: fullName,
        employee_number: employeeNumber,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true, email };
}

export async function resendOtp(email: string) {
  const supabase = await createClient();
  await supabase.auth.resend({
    type: "signup",
    email,
  });
}

export async function verifyOtp(_prev: VerifyOtpState, formData: FormData): Promise<VerifyOtpState> {
  const email = (formData.get("email") as string)?.trim();
  const token = (formData.get("token") as string)?.trim();

  if (!email || !token) {
    return { error: "Email and verification code are required" };
  }

  if (!isValidFrontierEmail(email)) {
    return { error: FRONTIER_EMAIL_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return { error: error.message };
  }

  redirect(COMPLETE_PROFILE_PATH);
}
