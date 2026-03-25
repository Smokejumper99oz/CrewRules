"use client";

import { useState } from "react";
import { formatDisplayName } from "@/lib/format-display-name";
import { updateUserRole } from "./actions";
import type { UserRow } from "./actions";

export function UsersTable({
  users,
  currentUserRole,
  currentUserId,
}: {
  users: UserRow[];
  currentUserRole: string | null;
  currentUserId: string | null;
}) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdating(userId);
    setError(null);
    const result = await updateUserRole(userId, newRole as "pilot" | "flight_attendant" | "tenant_admin");
    setUpdating(null);
    if (result.error) setError(result.error);
    if (!result.error) window.location.reload();
  }

  if (users.length === 0) {
    return <p className="text-sm text-slate-500">No users yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/5">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5 bg-white/5">
            <th className="px-4 py-3 text-left font-medium text-slate-300">Email</th>
            <th className="px-4 py-3 text-left font-medium text-slate-300">Name</th>
            <th className="px-4 py-3 text-left font-medium text-slate-300">Portal</th>
            <th className="px-4 py-3 text-left font-medium text-slate-300">Role</th>
            <th className="px-4 py-3 text-left font-medium text-slate-300">Base</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const canEdit =
              u.id !== currentUserId &&
              (currentUserRole === "super_admin" || (currentUserRole === "tenant_admin" && u.role !== "super_admin"));
            return (
              <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-white">{u.email ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">{formatDisplayName(u.full_name) || "—"}</td>
                <td className="px-4 py-3 text-slate-300">{u.portal}</td>
                <td className="px-4 py-3">
                  {canEdit ? (
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={updating === u.id}
                      className="rounded border border-white/10 bg-white/5 px-2 py-1 text-slate-300 focus:border-[#75C043]/50 focus:outline-none disabled:opacity-50"
                    >
                      <option value="pilot">Pilot</option>
                      <option value="flight_attendant">Flight Attendant</option>
                      <option value="tenant_admin">Admin</option>
                    </select>
                  ) : (
                    <span className="text-slate-300">
                      {u.role === "super_admin" ? "Platform Owner" : u.role === "tenant_admin" ? "Admin" : u.role}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-300">{u.base_airport ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
