import { getProfile } from "@/lib/profile";
import { SuperAdminUsersPageClient } from "@/components/super-admin/super-admin-users-page-client";
import { InviteUserForm } from "../people/invite-form";
import { getFrontierPilotAdminUsers, updateFrontierPilotAdminUserAccess } from "./actions";

export default async function FrontierPilotAdminUsersPage() {
  const profile = await getProfile();
  const users = await getFrontierPilotAdminUsers();

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200">
      <h1 className="text-xl font-semibold tracking-tight border-b border-slate-200 pb-2 text-[#1a2b4b]">Users</h1>
      <p className="mt-2 text-sm text-slate-600">
        Frontier Airline pilots roster. Tenant admins manage crew in this tenant only.
      </p>

      <InviteUserForm className="mt-6" />

      <div className="mt-8">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-600">All users</h2>
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
