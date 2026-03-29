"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2 } from "lucide-react";
import {
  updateSuperAdminUserAccess,
  type SuperAdminUserRow,
  type UpdateSuperAdminUserAccessInput,
} from "@/lib/super-admin/actions";

export type SuperAdminUsersPageVariant = "super-admin" | "frontier-pilots-admin";
import { TENANT_CONFIG } from "@/lib/tenant-config";
import { formatDisplayName } from "@/lib/format-display-name";
import { formatUsPhoneDisplay, formatUsPhoneStored } from "@/lib/format-us-phone";

type Props = {
  users: SuperAdminUserRow[];
  currentUserRole: string;
  currentUserId: string;
  /** Tenant admin users page: narrower UI and scoped `updateUserAccess`. */
  variant?: SuperAdminUsersPageVariant;
  updateUserAccess?: (
    userId: string,
    data: UpdateSuperAdminUserAccessInput
  ) => Promise<{ error?: string }>;
};

/** Base role label for non-super_admin: Pilot or FA. */
function baseRoleLabel(row: { role: string }): string {
  return row.role === "flight_attendant" ? "FA" : "Pilot";
}

function tenantLabel(tenant: string): string {
  return TENANT_CONFIG[tenant]?.displayName ?? tenant;
}

/** Pending Deletion when either soft-delete timestamp is set (see scheduleAccountDeletion). */
function isAccountPendingDeletion(row: SuperAdminUserRow): boolean {
  return row.deleted_at != null || row.deletion_scheduled_for != null;
}

function deletionScheduledTitle(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return `Scheduled deletion: ${d.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}`;
}

/** Shared Role/Status chips: one line, consistent height, aligned with table rows. */
const usersTablePill =
  "inline-flex h-6 shrink-0 items-center justify-center whitespace-nowrap rounded-md border px-2.5 text-xs font-semibold leading-none";

/** Same width for single-line Active in the Status column (~fits `Active` at text-xs + padding). */
const usersTableCompactStatusWidth = "w-[3.75rem] min-w-[3.75rem] max-w-[3.75rem] box-border";

/** Never signed in (Auth `last_sign_in_at` null when loaded); same amber family as before. */
const notJoinedStatusPill =
  "inline-flex h-6 shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-amber-400/30 bg-amber-500/15 px-2 text-[10px] font-semibold leading-none text-amber-200";

/** Signed in but welcome/onboarding marker still null; distinct from never-signed-in. */
const onboardingPendingStatusPill =
  "inline-flex h-6 shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-cyan-400/35 bg-cyan-500/12 px-2 text-[10px] font-semibold leading-none text-cyan-100";

/**
 * Status column: Auth sign-in when available, then welcome marker. Never infer "Not Joined" from welcome alone.
 */
function usersTablePrimaryStatusNode(u: SuperAdminUserRow): ReactNode {
  if (isAccountPendingDeletion(u)) {
    return (
      <span
        className={`${usersTablePill} border-orange-400/30 bg-orange-500/15 text-orange-200`}
        title={deletionScheduledTitle(u.deletion_scheduled_for)}
      >
        Pending Deletion
      </span>
    );
  }

  const authLoaded = "last_sign_in_at" in u;

  if (authLoaded) {
    if (u.last_sign_in_at == null) {
      return <span className={notJoinedStatusPill}>Not Joined</span>;
    }
    if ((u.welcome_modal_version_seen ?? null) == null) {
      return <span className={onboardingPendingStatusPill}>Onboarding Pending</span>;
    }
    return (
      <span
        className={`${usersTablePill} ${usersTableCompactStatusWidth} border-slate-400/30 bg-slate-500/18 text-slate-200`}
      >
        Active
      </span>
    );
  }

  if ((u.welcome_modal_version_seen ?? null) == null) {
    return <span className={onboardingPendingStatusPill}>Onboarding Pending</span>;
  }
  return (
    <span
      className={`${usersTablePill} ${usersTableCompactStatusWidth} border-slate-400/30 bg-slate-500/18 text-slate-200`}
    >
      Active
    </span>
  );
}

/** Frontier `/admin/users`: hide platform identity from tenant admins (display only; super-admin page unchanged). */
function frontierTenantViewerMasksPlatformOwnerRow(
  isFrontier: boolean,
  viewerRole: string,
  u: SuperAdminUserRow
): boolean {
  return isFrontier && viewerRole !== "super_admin" && u.role === "super_admin";
}

/**
 * When masking a platform owner row for a tenant admin: show email only if it is a Frontier company address;
 * otherwise redact so private login emails are not exposed.
 */
function emailForFrontierTenantAdminPlatformRow(u: SuperAdminUserRow): string {
  const raw = (u.email ?? "").trim();
  if (!raw) return "—";
  if (raw.toLowerCase().endsWith("@flyfrontier.com")) return raw;
  return "—";
}

/** Mentee has not completed first-use welcome onboarding (profile `welcome_modal_version_seen` still null). */
function frontierMenteePreWelcomeOnboarding(u: SuperAdminUserRow): boolean {
  return u.isMentee && (u.welcome_modal_version_seen ?? null) === null;
}

/** Violet Mentee pill: Frontier shows first-year DOH as well as assignment-backed mentees; super-admin stays assignment-only. */
function showMenteeRolePill(isFrontier: boolean, u: SuperAdminUserRow): boolean {
  if (isFrontier) return u.isMentee || Boolean(u.mentoring_first_year_hire);
  return u.isMentee;
}

/** Email cell for `/frontier/pilots/admin/users` only; super-admin roster uses raw `u.email` when variant is default. */
function emailDisplayedOnFrontierTenantUsersTable(
  isFrontier: boolean,
  currentUserRole: string,
  u: SuperAdminUserRow
): string {
  if (!isFrontier) return u.email ?? "—";
  if (frontierMenteePreWelcomeOnboarding(u)) return "—";
  if (frontierTenantViewerMasksPlatformOwnerRow(isFrontier, currentUserRole, u)) {
    return emailForFrontierTenantAdminPlatformRow(u);
  }
  return u.email ?? "—";
}

export function SuperAdminUsersPageClient({
  users,
  currentUserRole,
  currentUserId,
  variant = "super-admin",
  updateUserAccess: updateUserAccessProp,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SuperAdminUserRow | null>(null);
  const [phoneValue, setPhoneValue] = useState("");
  const [mentorPhoneValue, setMentorPhoneValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFrontier = variant === "frontier-pilots-admin";
  const persistUserAccess = updateUserAccessProp ?? updateSuperAdminUserAccess;

  const canEditUser = (u: SuperAdminUserRow): boolean => {
    if (!isFrontier) return true;
    if (u.role === "super_admin") return false;
    if (u.role === "tenant_admin" && currentUserRole !== "super_admin") return false;
    return true;
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) => {
      const maskPo = frontierTenantViewerMasksPlatformOwnerRow(isFrontier, currentUserRole, u);
      const emailMatches = maskPo
        ? emailForFrontierTenantAdminPlatformRow(u).toLowerCase().includes(q)
        : (u.email ?? "").toLowerCase().includes(q);
      return (
        (u.full_name ?? "").toLowerCase().includes(q) ||
        emailMatches ||
        (!isFrontier && (u.tenant ?? "").toLowerCase().includes(q)) ||
        (u.employee_number ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search, isFrontier, currentUserRole]);

  const isCurrentSuperAdmin = currentUserRole === "super_admin";

  function openEdit(user: SuperAdminUserRow) {
    setEditing(user);
    setPhoneValue(formatUsPhoneDisplay(user.phone ?? ""));
    setMentorPhoneValue(formatUsPhoneDisplay(user.mentor_phone ?? ""));
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
    const super_admin =
      isCurrentSuperAdmin && !isFrontier ? formData.get("super_admin") === "on" : undefined;

    const data: UpdateSuperAdminUserAccessInput = {
      role: baseRole,
      is_admin,
      is_mentor,
      super_admin,
      phone: formData.get("phone")?.toString().trim() || null,
      mentor_phone: formData.get("mentor_phone")?.toString().trim() || null,
      mentor_contact_email:
        formData.get("mentor_contact_email")?.toString().trim() || null,
      employee_number: formData.get("employee_number")?.toString().trim() || null,
      mentee_employee_number:
        formData.get("mentee_employee_number")?.toString()?.trim() || null,
    };

    const result = await persistUserAccess(editing.id, data);
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
          placeholder={
            isFrontier
              ? "Search by name, email, employee number…"
              : "Search by name, email, tenant, employee number..."
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-lg border border-slate-600/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-[#75C043]/50 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full min-w-[780px] text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              <th className="px-4 py-3 text-left font-medium text-slate-300">Name</th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">Email</th>
              {!isFrontier ? (
                <th className="px-4 py-3 text-left font-medium text-slate-300">Tenant</th>
              ) : null}
              <th className="px-4 py-3 text-left font-medium text-slate-300">Role</th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">Status</th>
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
                <td className="align-middle px-4 py-3 text-slate-200">{formatDisplayName(u.full_name) || "—"}</td>
                <td className="align-middle px-4 py-3 text-slate-300">
                  {emailDisplayedOnFrontierTenantUsersTable(isFrontier, currentUserRole, u)}
                </td>
                {!isFrontier ? (
                  <td className="align-middle px-4 py-3 text-slate-300">{tenantLabel(u.tenant)}</td>
                ) : null}
                <td className="align-middle px-4 py-3 text-slate-300">
                  <span className="inline-flex max-w-full flex-wrap items-center gap-1.5 sm:flex-nowrap">
                    {frontierTenantViewerMasksPlatformOwnerRow(isFrontier, currentUserRole, u) ? (
                      <>
                        <span
                          className={`${usersTablePill} border-slate-400/35 bg-slate-500/20 text-slate-200`}
                        >
                          {baseRoleLabel(u)}
                        </span>
                        {u.is_admin && (
                          <span
                            className={`${usersTablePill} border-emerald-400/35 bg-emerald-500/15 text-emerald-200`}
                          >
                            Admin
                          </span>
                        )}
                        {u.is_mentor && (
                          <span
                            className={`${usersTablePill} border-cyan-400/35 bg-cyan-500/15 text-cyan-200`}
                          >
                            Mentor
                          </span>
                        )}
                        {showMenteeRolePill(isFrontier, u) && (
                          <span
                            className={`${usersTablePill} border-violet-400/35 bg-violet-500/15 text-violet-200`}
                          >
                            Mentee
                          </span>
                        )}
                      </>
                    ) : u.role === "super_admin" ? (
                      <>
                        <span
                          className={`${usersTablePill} border-amber-400/35 bg-amber-500/15 text-amber-200`}
                        >
                          Platform Owner
                        </span>
                        {showMenteeRolePill(isFrontier, u) && (
                          <span
                            className={`${usersTablePill} border-violet-400/35 bg-violet-500/15 text-violet-200`}
                          >
                            Mentee
                          </span>
                        )}
                      </>
                    ) : u.role === "tenant_admin" ? (
                      <>
                        <span
                          className={`${usersTablePill} border-sky-400/35 bg-sky-500/15 text-sky-200`}
                        >
                          Tenant admin
                        </span>
                        {u.is_mentor && (
                          <span
                            className={`${usersTablePill} border-cyan-400/35 bg-cyan-500/15 text-cyan-200`}
                          >
                            Mentor
                          </span>
                        )}
                        {showMenteeRolePill(isFrontier, u) && (
                          <span
                            className={`${usersTablePill} border-violet-400/35 bg-violet-500/15 text-violet-200`}
                          >
                            Mentee
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span
                          className={`${usersTablePill} border-slate-400/35 bg-slate-500/20 text-slate-200`}
                        >
                          {baseRoleLabel(u)}
                        </span>
                        {u.is_admin && (
                          <span
                            className={`${usersTablePill} border-emerald-400/35 bg-emerald-500/15 text-emerald-200`}
                          >
                            Admin
                          </span>
                        )}
                        {u.is_mentor && (
                          <span
                            className={`${usersTablePill} border-cyan-400/35 bg-cyan-500/15 text-cyan-200`}
                          >
                            Mentor
                          </span>
                        )}
                        {showMenteeRolePill(isFrontier, u) && (
                          <span
                            className={`${usersTablePill} border-violet-400/35 bg-violet-500/15 text-violet-200`}
                          >
                            Mentee
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </td>
                <td className="align-middle px-4 py-3 text-slate-300">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {usersTablePrimaryStatusNode(u)}
                    {u.mentoring_military_leave ? (
                      <span
                        className={`${usersTablePill} border-[#556b3a]/40 bg-[#2f3a23]/25 text-[#cdd6a3]`}
                        title="Military Leave"
                      >
                        MIL LEAVE
                      </span>
                    ) : null}
                    {isFrontier && u.mentoring_first_year_hire && !u.isMentee ? (
                      <span
                        className={`${usersTablePill} border-slate-400/35 bg-slate-500/15 text-slate-300`}
                        title="First-year hire; no active mentor assignment in CrewRules yet"
                      >
                        Unassigned
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="align-middle px-4 py-3 text-slate-300">{u.employee_number ?? "—"}</td>
                <td className="align-middle px-4 py-3 text-slate-300">
                  <span className="whitespace-nowrap tabular-nums">
                    {formatUsPhoneStored(u.phone) ?? "—"}
                  </span>
                </td>
                <td className="align-middle px-4 py-3 text-right">
                  {canEditUser(u) ? (
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">—</span>
                  )}
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

            <form key={editing.id} onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <p className="rounded bg-rose-500/20 px-3 py-2 text-sm text-rose-400">
                  {error}
                </p>
              )}

              {editing.role === "tenant_admin" ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Role</label>
                  <p className="rounded border border-slate-600/40 bg-slate-800/30 px-3 py-2 text-sm text-slate-300">
                    Tenant admin (unchanged)
                  </p>
                  <input type="hidden" name="role" value="pilot" />
                </div>
              ) : (
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
              )}

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

              {isCurrentSuperAdmin && !isFrontier && (
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
                  onChange={(e) => setPhoneValue(formatUsPhoneDisplay(e.target.value))}
                  className="w-full rounded border border-slate-600/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-[#75C043]/50 focus:outline-none"
                  placeholder="(XXX) XXX-XXXX"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Mentor phone (mentee card)
                </label>
                <input
                  type="tel"
                  name="mentor_phone"
                  value={mentorPhoneValue}
                  onChange={(e) => setMentorPhoneValue(formatUsPhoneDisplay(e.target.value))}
                  className="w-full rounded border border-slate-600/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-[#75C043]/50 focus:outline-none"
                  placeholder="Optional; overrides profile phone on mentor card"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Mentor contact email (mentee card)
                </label>
                <input
                  type="email"
                  name="mentor_contact_email"
                  defaultValue={editing.mentor_contact_email ?? ""}
                  className="w-full rounded border border-slate-600/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-[#75C043]/50 focus:outline-none"
                  placeholder="Preferred email for mentees (not login email)"
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
