"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/profile";
import { canManageUsersInTenant } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { sendTenantAdminInviteEmail } from "@/lib/email/send-tenant-admin-invite";

const TENANT = "frontier";

export type UserRow = {
  id: string;
  email: string | null;
  tenant: string;
  portal: string;
  role: string;
  full_name: string | null;
  position: string | null;
  base_airport: string | null;
  created_at: string;
};

export async function getTenantUsers(): Promise<{ users: UserRow[]; error?: string }> {
  const profile = await getProfile();
  if (!canManageUsersInTenant(profile, TENANT)) {
    return { users: [], error: "Unauthorized" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, tenant, portal, role, full_name, position, base_airport, created_at")
    .eq("tenant", TENANT)
    .order("created_at", { ascending: false });

  if (error) return { users: [], error: error.message };
  return { users: (data ?? []) as UserRow[] };
}

export async function inviteUser(formData: FormData): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!canManageUsersInTenant(profile, TENANT)) {
    return { error: "Unauthorized" };
  }

  const email = formData.get("email")?.toString()?.trim();
  const role = (formData.get("role")?.toString() ?? "pilot") as Role;
  const portal = formData.get("portal")?.toString() ?? "pilots";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Valid email required" };
  }
  if (!["pilot", "flight_attendant", "tenant_admin"].includes(role)) {
    return { error: "Invalid role" };
  }
  if (!["pilots", "fa"].includes(portal)) {
    return { error: "Invalid portal" };
  }

  const portalValue = portal === "fa" ? "fa" : "pilots";
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const redirectTo = `${appUrl}/frontier/pilots/reset-password`;

  try {
    const admin = createAdminClient();
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo,
        data: { tenant: TENANT, portal: portalValue, role },
      },
    });
    if (linkError) return { error: linkError.message };

    const actionLink = linkData?.properties?.action_link;
    const inviteUrl = typeof actionLink === "string" && actionLink.length > 0 ? actionLink : null;
    if (!inviteUrl) {
      return { error: "Invite link could not be generated" };
    }

    const userId = linkData?.user?.id;
    if (!userId) {
      return { error: "Invite could not create a user record" };
    }

    const { error: upsertError } = await admin
      .from("profiles")
      .upsert(
        {
          id: userId,
          email,
          tenant: TENANT,
          portal: portalValue,
          role,
        },
        { onConflict: "id", ignoreDuplicates: false }
      );
    if (upsertError) return { error: upsertError.message };

    const sendResult = await sendTenantAdminInviteEmail({
      to: email,
      fullName: null,
      airlineName: "Frontier Airlines",
      inviteUrl,
      supportEmail: "sven.folmer@flyfrontier.com",
    });
    if (!sendResult.ok) return { error: sendResult.error };

    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to invite" };
  }
}

export async function updateUserRole(userId: string, role: Role): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!canManageUsersInTenant(profile, TENANT)) {
    return { error: "Unauthorized" };
  }
  if (userId === profile?.id && !["super_admin", "tenant_admin"].includes(role)) {
    return { error: "Cannot demote yourself" };
  }
  if (!["pilot", "flight_attendant", "tenant_admin"].includes(role)) {
    return { error: "Invalid role" };
  }
  if (profile?.role === "tenant_admin" && role === "super_admin") {
    return { error: "Tenant admins cannot create super admins" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .eq("tenant", TENANT);

  if (error) return { error: error.message };
  return {};
}
