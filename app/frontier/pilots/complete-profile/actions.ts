"use server";

import { redirect } from "next/navigation";
import { createActionClient } from "@/lib/supabase/server-action";
import { assignInboundAlias } from "@/lib/email/assign-inbound-alias";

const TENANT = "frontier";
const PORTAL = "pilots";
const PORTAL_PATH = `/${TENANT}/${PORTAL}/portal`;
const LOGIN_PATH = `/${TENANT}/${PORTAL}/login`;

export type CreateProfileState = { error?: string } | null;

export async function createProfile(_prev: CreateProfileState): Promise<CreateProfileState> {
  const supabase = await createActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`${LOGIN_PATH}?error=not_signed_in`);
  }

  const email = (user.email ?? "").toLowerCase().trim();
  if (!email.endsWith("@flyfrontier.com")) {
    redirect(`${LOGIN_PATH}?error=company_email_required`);
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      tenant: TENANT,
      portal: PORTAL,
      role: "pilot",
      plan: "free",
      display_timezone_mode: "base",
      time_format: "24h",
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("[createProfile] upsert failed:", error.code, error.message);
    return { error: error.message };
  }

  try {
    await assignInboundAlias(user.id);
  } catch (err) {
    console.warn("[createProfile] alias assignment failed:", err);
  }

  redirect(PORTAL_PATH);
}
