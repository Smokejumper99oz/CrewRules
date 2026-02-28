import { getProfile } from "@/lib/profile";
import { getTenantUsers } from "./actions";
import { InviteUserForm } from "./invite-form";
import { UsersTable } from "./users-table";

export default async function AdminPeoplePage() {
  const profile = await getProfile();
  const { users, error } = await getTenantUsers();
  return (
    <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6 transition-all duration-200">
      <h1 className="text-xl font-semibold tracking-tight border-b border-white/5">
        Users
      </h1>
      <p className="mt-2 text-slate-300">
        Invite and manage crew accounts for Frontier. Tenant admins can only manage users in this tenant.
      </p>

      <InviteUserForm className="mt-6" />

      {error && (
        <p className="mt-4 text-sm text-rose-400">{error}</p>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
          Existing users
        </h2>
        <UsersTable users={users} currentUserRole={profile?.role ?? null} currentUserId={profile?.id ?? null} />
      </div>
    </div>
  );
}
