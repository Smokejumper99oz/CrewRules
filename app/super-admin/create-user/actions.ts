"use server";

import { revalidatePath } from "next/cache";
import { gateSuperAdmin } from "@/lib/super-admin/gate";
import { createAdminClient } from "@/lib/supabase/admin";

export type CreateUserState = {
  ok?: boolean;
  error?: string;
  invitedEmail?: string;
} | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["tenant_admin", "pilot", "flight_attendant"] as const;
const VALID_PORTALS = ["pilots", "flight-attendants"] as const;

export async function createInvitedUser(
  _prev: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  await gateSuperAdmin();

  const email = formData.get("email")?.toString().trim() ?? "";
  const fullName = formData.get("full_name")?.toString().trim() ?? "";
  const tenant = formData.get("tenant")?.toString().trim() ?? "";
  const portal = formData.get("portal")?.toString().trim() ?? "";
  const role = formData.get("role")?.toString().trim() ?? "";
  const isAdminFlag = formData.get("is_admin") === "on";

  if (!EMAIL_RE.test(email)) return { error: "A valid email address is required." };
  if (!tenant) return { error: "Tenant is required." };
  if (!VALID_PORTALS.includes(portal as (typeof VALID_PORTALS)[number])) {
    return { error: "Invalid portal." };
  }
  if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
    return { error: "Invalid role." };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const redirectTo = `${appUrl}/auth/callback`;

  try {
    const admin = createAdminClient();

    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo,
        data: { tenant, portal, role, full_name: fullName || undefined },
      }
    );

    if (inviteErr) return { error: inviteErr.message };

    const userId = inviteData?.user?.id;
    if (userId) {
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
    }

    revalidatePath("/super-admin/create-user");
    revalidatePath("/super-admin/users");

    return { ok: true, invitedEmail: email };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to invite user." };
  }
}
