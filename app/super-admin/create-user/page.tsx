import { gateSuperAdmin } from "@/lib/super-admin/gate";
import { CreateUserForm } from "@/components/super-admin/create-user-form";

export const dynamic = "force-dynamic";

export default async function CreateUserPage() {
  await gateSuperAdmin();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Create User</h1>
        <p className="mt-1 text-sm text-slate-400 max-w-xl">
          Invite someone to a specific airline portal with any email address — not restricted to
          the airline domain. Useful for ALPA program managers, union reps, or external admins
          who need access without an airline email.
        </p>
      </div>

      <CreateUserForm />
    </div>
  );
}
