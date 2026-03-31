"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isLiveForEmailAndRole,
  getSignupRouteForEmail,
  inferAirlineFromEmail,
} from "@/lib/supported-airlines";

export type AccessRequestFormState = {
  error?: string;
  success?: boolean;
  airlineLive?: boolean;
  signupRoute?: string;
  values?: {
    full_name: string;
    email: string;
    role: string;
    airline: string;
    employee_number: string;
  };
  /** Client uses as `key` on `<form>` so defaultValue re-applies after each failed submit. */
  echoKey?: string;
};

function formEchoFromFormData(formData: FormData): NonNullable<AccessRequestFormState["values"]> {
  return {
    full_name: String(formData.get("full_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? ""),
    airline: String(formData.get("airline") ?? ""),
    employee_number: String(formData.get("employee_number") ?? ""),
  };
}

function withAccessRequestError(
  error: string,
  formData: FormData
): AccessRequestFormState {
  return {
    error,
    values: formEchoFromFormData(formData),
    echoKey: randomUUID(),
  };
}

/** RLS requires null or length >= 3; coercing short/partial IDs avoids spurious rejections. */
function normalizeWaitlistEmployeeNumber(raw: string | null): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed.length === 0 || trimmed.length < 3) return null;
  return trimmed;
}

function getSupabaseEnvCheck(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url === "https://your-project-ref.supabase.co") {
    return "Supabase env vars missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart dev server.";
  }
  return null;
}

/** Service-role client bypasses RLS; required for public waitlist writes in production. */
function getWaitlistAdminEnvError(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || url === "https://your-project-ref.supabase.co") {
    return "Waitlist signup is unavailable: NEXT_PUBLIC_SUPABASE_URL is missing or invalid. Set it in the server environment and redeploy.";
  }
  if (!serviceKey?.trim()) {
    return "Waitlist signup is unavailable: SUPABASE_SERVICE_ROLE_KEY is not set on the server. Add it in your hosting environment (Dashboard → Project Settings → API → service_role) and redeploy.";
  }
  return null;
}

export async function submitAccessRequest(
  _prev: AccessRequestFormState | null,
  formData: FormData
) {
  const fullName = (formData.get("full_name") as string)?.trim();
  const email = formData.get("email") as string;
  const role = (formData.get("role") as string)?.trim();
  const airline = formData.get("airline") as string | null;
  const employeeNumber = formData.get("employee_number") as string | null;

  if (!fullName || !email?.trim()) {
    return withAccessRequestError("Full name and email are required", formData);
  }
  if (!role || (role !== "pilot" && role !== "fa")) {
    return withAccessRequestError("Please select Pilot or Flight Attendant", formData);
  }

  const envError = getSupabaseEnvCheck();
  if (envError) {
    return withAccessRequestError(envError, formData);
  }

  const trimmedEmail = email.trim();
  const requestedPortal = role === "pilot" ? "pilot" : "fa";
  const emailLower = trimmedEmail.toLowerCase();
  const isFrontierEmail = emailLower.endsWith("@flyfrontier.com");
  const isPilot = role === "pilot";

  try {
    const inferredAirline = inferAirlineFromEmail(trimmedEmail);

    if (isFrontierEmail && isPilot) {
      const displayAirline = airline?.trim() || inferredAirline || "Frontier Airlines";
      const params = new URLSearchParams({
        airline: displayAirline,
        live: "1",
        signupRoute: "/frontier/pilots/sign-up",
      });
      redirect(`/request-access/success?${params.toString()}`);
    }

    if (isLiveForEmailAndRole(trimmedEmail, role)) {
      const signupRoute = getSignupRouteForEmail(trimmedEmail);
      const displayAirline = airline?.trim() || inferredAirline;
      const params = new URLSearchParams({
        airline: displayAirline,
        live: "1",
        ...(signupRoute && { signupRoute }),
      });
      redirect(`/request-access/success?${params.toString()}`);
    }

    const displayAirline = airline?.trim() || inferredAirline;
    const waitlistAdminEnvError = getWaitlistAdminEnvError();
    if (waitlistAdminEnvError) {
      return withAccessRequestError(waitlistAdminEnvError, formData);
    }

    const waitlistEmployeeNumber = normalizeWaitlistEmployeeNumber(employeeNumber);
    const admin = createAdminClient();
    const { error } = await admin.from("waitlist").upsert(
      {
        email: trimmedEmail,
        full_name: fullName,
        requested_portal: requestedPortal,
        airline: displayAirline,
        source: "request_access",
        status: "pending",
        employee_number: waitlistEmployeeNumber,
      },
      { onConflict: "email", ignoreDuplicates: true }
    );

    if (error) {
      console.error("[Request Access] waitlist insert error:", error);
      return withAccessRequestError(
        `${error.message}${error.code ? ` (code: ${error.code})` : ""}`,
        formData
      );
    }

    const successParams = new URLSearchParams({ airline: displayAirline });
    if (role === "fa") {
      successParams.set("role", "fa");
    }
    redirect(`/request-access/success?${successParams.toString()}`);
  } catch (err) {
    if (isRedirectError(err)) {
      throw err;
    }
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
      return withAccessRequestError(
        "Could not reach Supabase. See terminal (where npm run dev runs) for details. Check: (1) Restart dev server. (2) Supabase Dashboard → project not paused. (3) .env.local has correct NEXT_PUBLIC_SUPABASE_URL.",
        formData
      );
    }
    return withAccessRequestError(message, formData);
  }
}
