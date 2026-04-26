"use server";

import { revalidatePath } from "next/cache";
import { getAppOriginForAuthInvites } from "@/lib/app-url-for-auth-invite";
import { sendCrewRulesUniversalInviteEmail } from "@/lib/email/send-crewrules-universal-invite";
import { requireSuperAdminForServerAction } from "@/lib/super-admin/gate";
import { TENANT_CONFIG } from "@/lib/tenant-config";
import { createAdminClient } from "@/lib/supabase/admin";

export type CreateUserState = {
  ok?: boolean;
  error?: string;
  invitedEmail?: string;
} | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["tenant_admin", "pilot", "flight_attendant"] as const;
const VALID_PORTALS = ["pilots", "flight-attendants", "ops"] as const;

const ALLOWED_TENANTS = new Set<string>([...Object.keys(TENANT_CONFIG), "demo135"]);

export async function createInvitedUser(
  _prev: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const gate = await requireSuperAdminForServerAction();
  if (!gate.ok) return { error: gate.error };

  const email = formData.get("email")?.toString().trim() ?? "";
  const fullName = formData.get("full_name")?.toString().trim() ?? "";
  const tenant = formData.get("tenant")?.toString().trim() ?? "";
  const portal = formData.get("portal")?.toString().trim() ?? "";
  const role = formData.get("role")?.toString().trim() ?? "";
  const isAdminFlag = formData.get("is_admin") === "on";

  if (!EMAIL_RE.test(email)) return { error: "A valid email address is required." };
  if (!tenant) return { error: "Tenant is required." };
  if (!ALLOWED_TENANTS.has(tenant)) return { error: "Invalid tenant." };
  if (!VALID_PORTALS.includes(portal as (typeof VALID_PORTALS)[number])) {
    return { error: "Invalid portal." };
  }
  if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
    return { error: "Invalid role." };
  }

  const appUrl = getAppOriginForAuthInvites();
  // Generic CrewRules™ password page — not airline-specific (contrast: Frontier admin invite uses
  // /frontier/pilots/reset-password). Must be listed in Supabase Auth redirect allow list.
  const redirectTo = `${appUrl}/auth/reset-password`;

  try {
    const admin = createAdminClient();

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo,
        data: { tenant, portal, role, full_name: fullName || undefined },
      },
    });

    if (linkError) return { error: linkError.message };

    const actionLink = linkData?.properties?.action_link;
    if (typeof actionLink !== "string" || !actionLink) {
      return { error: "Invite link could not be generated" };
    }

    const userId = linkData?.user?.id;
    if (!userId) {
      return { error: "Invite could not create a user record" };
    }

    const profilePayload: Record<string, unknown> = {
      id: userId,
      email,
      tenant,
      portal,
      role,
      is_admin: role === "tenant_admin" ? true : isAdminFlag,
    };
    if (fullName) profilePayload.full_name = fullName;

    const { error: profileErr } = await admin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id", ignoreDuplicates: false });

    if (profileErr) return { error: `User invited but profile creation failed: ${profileErr.message}` };

    // Store the action_link so the email can use /auth/accept-invite (avoids Supabase's default
    // invite email and prevents scanners from pre-consuming the one-time action_link).
    const { data: tokenRow, error: tokenError } = await admin
      .from("tenant_admin_invite_tokens")
      .insert({ action_link: actionLink, email, tenant, portal, role })
      .select("id")
      .single();
    if (tokenError || !tokenRow?.id) {
      return { error: tokenError?.message ?? "Failed to store invite token" };
    }

    const acceptInviteUrl = `${appUrl}/auth/accept-invite?id=${tokenRow.id}`;

    const sendResult = await sendCrewRulesUniversalInviteEmail({
      to: email,
      fullName: fullName || null,
      inviteUrl: acceptInviteUrl,
      portal,
      role,
    });
    if (!sendResult.ok) {
      return { error: sendResult.error };
    }

    revalidatePath("/super-admin/create-user");
    revalidatePath("/super-admin/users");

    return { ok: true, invitedEmail: email };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to invite user." };
  }
}
