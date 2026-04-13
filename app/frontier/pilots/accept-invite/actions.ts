"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function acceptInvite(id: string): Promise<{ error: string } | never> {
  if (!id || typeof id !== "string") {
    return { error: "Invalid invite link." };
  }

  const admin = createAdminClient();
  const { data: row, error: fetchError } = await admin
    .from("tenant_admin_invite_tokens")
    .select("id, action_link, used_at, expires_at")
    .eq("id", id)
    .single();

  if (fetchError || !row) {
    return { error: "Invite not found. Please ask your admin to send a new invite." };
  }

  if (row.used_at) {
    return { error: "This invite has already been used. Please ask your admin to send a new invite." };
  }

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { error: "This invite has expired. Please ask your admin to send a new invite." };
  }

  // Mark as used before redirecting to prevent double-use.
  await admin
    .from("tenant_admin_invite_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", id);

  // Redirect the browser to the Supabase action_link. Supabase will verify the
  // one-time invite token and redirect to /frontier/pilots/reset-password with
  // session tokens in the URL hash. This is safe because it is triggered by a
  // user button click (not an email link), so email scanners cannot pre-consume it.
  redirect(row.action_link);
}
