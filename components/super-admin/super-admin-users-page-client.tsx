"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2 } from "lucide-react";
import {
  updateSuperAdminUserAccess,
  type SuperAdminUserRow,
  type UpdateSuperAdminUserAccessInput,
} from "@/lib/super-admin/actions";
import { TENANT_CONFIG } from "@/lib/tenant-config";
import { formatDisplayName } from "@/lib/format-display-name";

type Props = {
  users: SuperAdminUserRow[];
  currentUserRole: string;
  currentUserId: string;
};

/** Base role label for non-super_admin: Pilot or FA. */
function baseRoleLabel(row: { role: string }): string {
  return row.role === "flight_attendant" ? "FA" : "Pilot";
}

function tenantLabel(tenant: string): string {
  return TENANT_CONFIG[tenant]?.displayName ?? tenant;
}

/** Format phone as XXX.XXX.XXXX (e.g. 9419325276 → 941.932.5276). */
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
}

export function SuperAdminUsersPageClient({
  users,
  currentUserRole,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SuperAdminUserRow | null>(null);
  const [phoneValue, setPhoneValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.tenant ?? "").toLowerCase().includes(q) ||
        (u.employee_number ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const isCurrentSuperAdmin = currentUserRole === "super_admin";

  function openEdit(user: SuperAdminUserRow) {
    setEditing(user);
    setPhoneValue(formatPhone(user.phone ?? ""));
    setError(null);
  }

  function closeEdit() {
    if (!pending) setEditing(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing || pending) return;
    setPending(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const baseRole = (formData.get("role") as "pilot" | "flight_attendant") ?? "pilot";
    const is_admin = formData.get("is_admin") === "on";
    const is_mentor = formData.get("is_mentor") === "on";
    const super_admin = isCurrentSuperAdmin
      ? formData.get("super_admin") === "on"
      : undefined;

    const data: UpdateSuperAdminUserAccessInput = {
      role: baseRole,
      is_admin,
      is_mentor,
      super_admin,
      phone: formData.get("phone")?.toString().trim() || null,
      employee_number: formData.get("employee_number")?.toString().trim() || null,
      mentee_employee_number:
        formData.get("mentee_employee_number")?.toString().trim() || null,
    };

    const result = await updateSuperAdminUserAccess(editing.id, data);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  const baseRole =
    editing?.role === "super_admin" || editing?.role === "tenant_admin"
      ? "pilot"
      : (editing?.role as "pilot" | "flight_attendant") ?? "pilot";

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) {
        e.preventDefault();
        closeEdit();
      }
    };
    if (editing) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [editing, pending]);

  return (
    <div className="space-y-3">
      <div>
        <input
          type="search"
          placeholder="Search by name, email, tenant, employee number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-lg border border-slate-600/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-[#75C043]/50 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              <th className="px-4 py-3 text-left font-medium text-slate-300">Name</th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">Email</th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">Tenant</th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">Role</th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">Emp #</th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">Phone</th>
              <th className="px-4 py-3 text-right font-medium text-slate-300">Edit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.id}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3 text-slate-200">{formatDisplayName(u.full_name) || "—"}</td>
                <td className="px-4 py-3 text-slate-300">{u.email ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">{tenantLabel(u.tenant)}</td>
                <td className="px-4 py-3 text-slate-300">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {u.role === "super_admin" ? (
                      <span className="inline-flex rounded-md border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                        Platform Owner
                      </span>
                    ) : (
                      <>
                        <span className="inline-flex rounded-md border border-slate-400/40 bg-slate-500/20 px-2 py-0.5 text-xs font-semibold text-slate-200">
                          {baseRoleLabel(u)}
                        </span>
                        {u.is_admin && (
                          <span className="inline-flex rounded-md border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                            Admin
                          </span>
                        )}
                        {u.is_mentor && (
                          <span className="inline-flex rounded-md border border-cyan-400/40 bg-cyan-500/20 px-2 py-0.5 text-xs font-semibold text-cyan-200">
                            Mentor
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300">{u.employee_number ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">{u.phone ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => openEdit(u)}
                    className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-slate-500">
          {users.length === 0 ? "No users yet." : "No users match your search."}
        </p>
      )}

      {/* Edit Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-modal-title"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 id="edit-user-modal-title" className="text-lg font-semibold text-slate-100">
                Edit User: {formatDisplayName(editing.full_name) || editing.email || "Unknown"}
              </h2>
              <button
                type="button"
                onClick={closeEdit}
                disabled={pending}
                className="rounded p-1 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 disabled:opacity-50"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <p className="rounded bg-rose-500/20 px-3 py-2 text-sm text-rose-400">
                  {error}
                </p>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Role (Pilot / Flight Attendant)
                </label>
                <select
                  name="role"
                  defaultValue={baseRole}
                  className="w-full rounded border border-slate-600/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 focus:border-[#75C043]/50 focus:outline-none"
                >
                  <option value="pilot">Pilot</option>
                  <option value="flight_attendant">Flight Attendant</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-is_admin"
                  name="is_admin"
                  defaultChecked={editing.is_admin || editing.role === "tenant_admin" || editing.role === "super_admin"}
                  className="rounded border-slate-600 bg-slate-800 text-[#75C043] focus:ring-[#75C043]/50"
                />
                <label htmlFor="edit-is_admin" className="text-sm text-slate-300">
                  Admin
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-is_mentor"
                  name="is_mentor"
                  defaultChecked={editing.is_mentor}
                  className="rounded border-slate-600 bg-slate-800 text-[#75C043] focus:ring-[#75C043]/50"
                />
                <label htmlFor="edit-is_mentor" className="text-sm text-slate-300">
                  Mentor
                </label>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Mentee employee # (optional)
                </label>
                <input
                  type="text"
                  name="mentee_employee_number"
                  defaultValue=""
                  className="w-full rounded border border-slate-600/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-[#75C043]/50 focus:outline-none"
                  placeholder={"Mentee's company employee number"}
                />
                <p className="mt-1 text-xs text-slate-500">
                  When Mentor is enabled, enter this user&apos;s mentee&apos;s employee number (same tenant) to create the assignment shown on the Mentoring page. Leave blank to only set the Mentor flag.
                </p>
              </div>

              {isCurrentSuperAdmin && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-super_admin"
                    name="super_admin"
                    defaultChecked={editing.role === "super_admin"}
                    disabled={editing.id === currentUserId}
                    className="rounded border-slate-600 bg-slate-800 text-[#75C043] focus:ring-[#75C043]/50 disabled:opacity-60"
                  />
                  <label htmlFor="edit-super_admin" className="text-sm text-slate-300">
                    Platform Owner
                    {editing.id === currentUserId && (
                      <span className="ml-1 text-xs text-slate-500">(you)</span>
                    )}
                  </label>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Employee Number
                </label>
                <input
                  type="text"
                  name="employee_number"
                  defaultValue={editing.employee_number ?? ""}
                  className="w-full rounded border border-slate-600/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-[#75C043]/50 focus:outline-none"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={phoneValue}
                  onChange={(e) => setPhoneValue(formatPhone(e.target.value))}
                  className="w-full rounded border border-slate-600/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-[#75C043]/50 focus:outline-none"
                  placeholder="XXX.XXX.XXXX"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={pending}
                  className="rounded-lg border border-slate-600/50 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#75C043] px-4 py-2 text-sm font-medium text-slate-950 hover:brightness-110 disabled:opacity-50"
                >
                  {pending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
