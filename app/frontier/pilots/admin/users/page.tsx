import { getProfile } from "@/lib/profile";
import { SuperAdminUsersPageClient } from "@/components/super-admin/super-admin-users-page-client";
import { InviteUserForm } from "../people/invite-form";
import { getFrontierPilotAdminUsers, updateFrontierPilotAdminUserAccess } from "./actions";

export default async function FrontierPilotAdminUsersPage() {
  const profile = await getProfile();
  const users = await getFrontierPilotAdminUsers();

  return (
    <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6 transition-all duration-200">
      <h1 className="text-xl font-semibold tracking-tight border-b border-white/5">Users</h1>
      <p className="mt-2 text-slate-300">
        Frontier Airline pilots roster. Tenant admins manage crew in this tenant only.
      </p>

      <InviteUserForm className="mt-6" />

      <div className="mt-8">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">All users</h2>
        <SuperAdminUsersPageClient
          users={users}
          currentUserRole={profile?.role ?? ""}
          currentUserId={profile?.id ?? ""}
          variant="frontier-pilots-admin"
          updateUserAccess={updateFrontierPilotAdminUserAccess}
        />
      </div>
    </div>
  );
}
