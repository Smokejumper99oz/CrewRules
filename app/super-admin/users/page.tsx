import { gateSuperAdmin } from "@/lib/super-admin/gate";
import { getAllUsersForSuperAdmin } from "@/lib/super-admin/actions";
import { SuperAdminUsersPageClient } from "@/components/super-admin/super-admin-users-page-client";

export default async function SuperAdminUsersPage() {
  const { profile } = await gateSuperAdmin();
  const users = await getAllUsersForSuperAdmin();

  return (
    <div className="-mt-6 space-y-2 sm:-mt-8">
      <div>
        <p className="text-sm text-slate-400">
          Manage User Roles and Access. Search by Name, Email, Tenant, or Employee Number.
        </p>
      </div>

      <SuperAdminUsersPageClient
        users={users}
        currentUserRole={profile.role}
        currentUserId={profile.id}
      />
    </div>
  );
}
