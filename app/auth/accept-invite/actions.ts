"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

/**
 * Exchanges a stored one-time token id for a Supabase invite action_link redirect.
 * Used by Super Admin invite emails (/auth/accept-invite) so scanners cannot pre-consume
 * the Supabase link embedded in the message.
 */
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

  await admin
    .from("tenant_admin_invite_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", id);

  redirect(row.action_link);
}

/** Form `action` — avoids inline "use server" handlers (Webpack/Next 15 can throw `undefined … .call`). */
export async function submitAcceptInvite(formData: FormData): Promise<void> {
  const id = formData.get("invite_id");
  if (typeof id !== "string" || !id.trim()) {
    return;
  }
  const result = await acceptInvite(id.trim());
  if (result && "error" in result) {
    return;
  }
  return;
}
