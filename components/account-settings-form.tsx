"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  updatePassword,
  scheduleAccountDeletion,
  cancelScheduledAccountDeletion,
} from "@/app/frontier/pilots/portal/profile/actions";

export type AccountSettingsFormVariant = "portal" | "light-admin";

type Props = {
  email: string | null;
  /** True when soft-delete has been scheduled (or timestamps partially set). */
  isAccountDeletionScheduled: boolean;
  /** ISO timestamp for final deletion; shown in scheduled state. */
  deletionScheduledFor: string | null;
  /** User-provided reason saved when deletion was scheduled. */
  deletionReasonScheduled?: string | null;
  /**
   * `light-admin`: always light chrome (Frontier pilot admin profile). Omit or use `portal` for pilot portal / theme-aware `dark:` styles.
   */
  variant?: AccountSettingsFormVariant;
};

function formatScheduledDeletionDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
}

export function AccountSettingsForm({
  email,
  isAccountDeletionScheduled,
  deletionScheduledFor,
  deletionReasonScheduled,
  variant = "portal",
}: Props) {
  const router = useRouter();
  const isLightAdmin = variant === "light-admin";
  const scheduledDeletionLabel = formatScheduledDeletionDate(deletionScheduledFor);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletionPending, setDeletionPending] = useState(false);
  const [deletionMessage, setDeletionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deletionReasonDraft, setDeletionReasonDraft] = useState("");

  const closeDeleteConfirmModal = useCallback(() => {
    if (deletionPending) return;
    setDeleteConfirmModalOpen(false);
    setDeleteConfirmInput("");
    setDeletionReasonDraft("");
  }, [deletionPending]);

  useEffect(() => {
    if (!deleteConfirmModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deletionPending) {
        e.preventDefault();
        closeDeleteConfirmModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteConfirmModalOpen, deletionPending, closeDeleteConfirmModal]);

  const deleteConfirmEnabled = deleteConfirmInput === "DELETE";

  const shell = isLightAdmin
    ? "min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md"
    : "min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6 dark:border-white/5 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-900/60 dark:to-slate-950/80 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]";

  const headerRule = isLightAdmin
    ? "mb-6 border-b border-slate-200 pb-4"
    : "mb-6 border-b border-slate-200 pb-4 dark:border-white/10";

  const accountTitle = isLightAdmin
    ? "text-lg font-semibold leading-snug tracking-tight text-[#1a2b4b]"
    : "text-base font-semibold leading-snug text-slate-900 sm:text-lg dark:text-white";

  const accountSubtitle = isLightAdmin
    ? "mt-1 text-pretty text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere]"
    : "mt-1 text-pretty text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400";

  const sectionShell = isLightAdmin
    ? "rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5"
    : "rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]";

  const sectionShellMt = isLightAdmin
    ? "mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5"
    : "mt-6 rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]";

  const sectionRule = isLightAdmin
    ? "border-b border-slate-200 pb-3"
    : "border-b border-slate-200/80 pb-3 dark:border-white/10";

  const sectionH3 = isLightAdmin
    ? "text-sm font-semibold tracking-tight text-slate-900"
    : "text-sm font-semibold tracking-tight text-slate-900 dark:text-white";

  const sectionLead = isLightAdmin
    ? "mt-4 text-xs text-slate-600"
    : "mt-4 text-xs text-slate-500 dark:text-slate-400";

  const insetPanel = isLightAdmin
    ? "mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 space-y-3"
    : "mt-4 rounded-lg border border-slate-200/80 bg-white/80 px-4 py-3 space-y-3 dark:border-white/10 dark:bg-slate-900/35";

  const insetLabel = isLightAdmin
    ? "text-xs font-medium text-slate-600"
    : "text-xs font-medium text-slate-500 dark:text-slate-400";

  const insetValue = isLightAdmin
    ? "text-sm text-slate-900 [overflow-wrap:anywhere]"
    : "text-sm text-slate-900 [overflow-wrap:anywhere] dark:text-slate-100";

  const insetHelp = isLightAdmin
    ? "mt-1 text-xs text-slate-600"
    : "mt-1 text-xs text-slate-500 dark:text-slate-400";

  const changePwBtn = isLightAdmin
    ? "text-sm font-medium text-emerald-800 underline-offset-2 hover:text-emerald-950 hover:underline"
    : "text-sm font-medium text-emerald-800 underline-offset-2 hover:text-emerald-950 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300";

  const pwFieldLabel = isLightAdmin
    ? "block text-xs font-medium text-slate-600"
    : "block text-xs font-medium text-slate-600 dark:text-slate-400";

  const pwInput = isLightAdmin
    ? "mt-1 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-emerald-600/50 focus:outline-none focus:ring-1 focus:ring-emerald-600/25"
    : "mt-1 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600/50 focus:outline-none focus:ring-1 focus:ring-emerald-600/25 dark:border-white/10 dark:bg-slate-900/60 dark:text-white dark:placeholder:text-slate-500";

  const dangerSection = isLightAdmin
    ? "mt-6 rounded-xl border border-red-200 bg-red-50/60 p-4 sm:p-5"
    : "mt-6 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4 sm:p-5 dark:border-red-500/35 dark:bg-red-950/25";

  const dangerRule = isLightAdmin
    ? "border-b border-red-200 pb-3"
    : "border-b border-red-500/20 pb-3 dark:border-red-500/25";

  const dangerH3 = isLightAdmin
    ? "text-sm font-semibold tracking-tight text-red-900"
    : "text-sm font-semibold tracking-tight text-slate-900 dark:text-white";

  const dangerLead = isLightAdmin
    ? "mt-3 text-xs leading-relaxed text-slate-600"
    : "mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400";

  const dangerInset = isLightAdmin
    ? "mt-4 rounded-lg border border-red-200 bg-white px-4 py-4"
    : "mt-4 rounded-lg border border-red-500/20 bg-white/90 px-4 py-4 dark:border-red-500/30 dark:bg-slate-950/60";

  const dangerH4 = isLightAdmin
    ? "text-sm font-semibold text-slate-900"
    : "text-sm font-semibold text-slate-900 dark:text-white";

  const dangerBody = isLightAdmin
    ? "mt-2 text-sm leading-relaxed text-slate-600"
    : "mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400";

  const scheduledRow = isLightAdmin
    ? "mt-3 text-sm font-medium text-slate-800"
    : "mt-3 text-sm font-medium text-slate-800 dark:text-slate-200";

  const scheduledDate = isLightAdmin ? "font-semibold text-red-700" : "font-semibold text-red-700 dark:text-red-300";

  const reasonLead = isLightAdmin
    ? "mt-3 text-sm leading-relaxed text-slate-600"
    : "mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400";

  const reasonStrong = isLightAdmin ? "font-medium text-slate-800" : "font-medium text-slate-800 dark:text-slate-200";

  const restoreBtn = isLightAdmin
    ? "mt-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-50"
    : "mt-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15";

  const deletePrimaryBtn = isLightAdmin
    ? "mt-4 rounded-lg border border-red-600/30 bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
    : "mt-4 rounded-lg border border-red-500/50 bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 dark:border-red-500/40 dark:bg-red-700 dark:hover:bg-red-600";

  const modalDialog = isLightAdmin
    ? "relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-5"
    : "relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-5 dark:border-white/10 dark:bg-slate-950 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]";

  const modalTitle = isLightAdmin
    ? "text-base font-semibold text-slate-900"
    : "text-base font-semibold text-slate-900 dark:text-white";

  const modalBody = isLightAdmin
    ? "mt-3 space-y-3 text-sm leading-relaxed text-slate-600"
    : "mt-3 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400";

  const modalFine = isLightAdmin ? "text-xs text-slate-500" : "text-xs text-slate-500 dark:text-slate-500";

  const modalLabel = isLightAdmin
    ? "block text-xs font-medium text-slate-600"
    : "block text-xs font-medium text-slate-600 dark:text-slate-400";

  const modalConfirmInput = isLightAdmin
    ? "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-emerald-600/50 focus:outline-none focus:ring-1 focus:ring-emerald-600/25"
    : "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600/50 focus:outline-none focus:ring-1 focus:ring-emerald-600/25 dark:border-white/10 dark:bg-slate-900/60 dark:text-white dark:placeholder:text-slate-500";

  const modalFooterRule = isLightAdmin
    ? "mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4"
    : "mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-white/10";

  const modalCancel = isLightAdmin
    ? "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-50"
    : "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15";

  const modalDelete = isLightAdmin
    ? "rounded-lg border border-red-600/40 bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
    : "rounded-lg border border-red-500/50 bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 dark:border-red-500/40 dark:bg-red-700 dark:hover:bg-red-600";

  return (
    <div className={shell}>
      <div className={headerRule}>
        <div className="min-w-0">
          <h2 className={accountTitle}>Account</h2>
          <p className={accountSubtitle}>
            Sign-in, security, password, and account-level controls.
          </p>
        </div>
      </div>

      <section className={sectionShell} aria-labelledby="account-sign-in-heading">
        <div className={sectionRule}>
          <h3 id="account-sign-in-heading" className={sectionH3}>
            Sign-in
          </h3>
        </div>
        <p className={sectionLead}>
          {isLightAdmin
            ? "Email address for your CrewRules™ admin account."
            : "Email address for your CrewRules™ account."}
        </p>
        <div className={insetPanel}>
          <div>
            <span className={insetLabel}>Email</span>
            <p className={insetValue}>{email ?? "—"}</p>
            <p className={`${insetHelp} font-bold`}>
              Email is managed by CrewRules™ based on your airline access and cannot be edited.
            </p>
          </div>
        </div>
      </section>

      <section className={sectionShellMt} aria-labelledby="account-security-heading">
        <div className={sectionRule}>
          <h3 id="account-security-heading" className={sectionH3}>
            Security
          </h3>
        </div>
        <p className={sectionLead}>Password and sign-in security for your CrewRules™ account.</p>
        <div className={insetPanel}>
          <button
            type="button"
            onClick={() => {
              setShowChangePassword(!showChangePassword);
              setPasswordMessage(null);
            }}
            className={changePwBtn}
          >
            {showChangePassword ? "Cancel" : "Change Password"}
          </button>
          {showChangePassword && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const newPw = (form.elements.namedItem("new_password") as HTMLInputElement)?.value ?? "";
                const confirm = (form.elements.namedItem("confirm_password") as HTMLInputElement)?.value ?? "";
                if (newPw !== confirm) {
                  setPasswordMessage({ type: "error", text: "Passwords do not match" });
                  return;
                }
                setPasswordSaving(true);
                setPasswordMessage(null);
                const result = await updatePassword(newPw);
                setPasswordSaving(false);
                if ("error" in result) {
                  setPasswordMessage({ type: "error", text: result.error });
                } else {
                  setPasswordMessage({ type: "success", text: "Password updated." });
                  setShowChangePassword(false);
                  form.reset();
                }
              }}
              className="mt-3 space-y-3"
            >
              <div>
                <label htmlFor="settings_new_password" className={pwFieldLabel}>
                  New password
                </label>
                <input
                  id="settings_new_password"
                  name="new_password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className={pwInput}
                />
              </div>
              <div>
                <label htmlFor="settings_confirm_password" className={pwFieldLabel}>
                  Confirm new password
                </label>
                <input
                  id="settings_confirm_password"
                  name="confirm_password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Repeat new password"
                  className={pwInput}
                />
              </div>
              {passwordMessage && (
                <p
                  className={`text-sm font-medium ${
                    passwordMessage.type === "success"
                      ? isLightAdmin
                        ? "text-emerald-800"
                        : "text-emerald-800 dark:text-emerald-300"
                      : isLightAdmin
                        ? "text-red-700"
                        : "text-red-700 dark:text-red-400"
                  }`}
                >
                  {passwordMessage.text}
                </p>
              )}
              <button
                type="submit"
                disabled={passwordSaving}
                className="rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:opacity-50"
              >
                {passwordSaving ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </section>

      <section className={dangerSection} aria-labelledby="account-danger-heading">
        <div className={dangerRule}>
          <h3 id="account-danger-heading" className={dangerH3}>
            Danger Zone
          </h3>
        </div>
        <p className={dangerLead}>Irreversible Actions — Proceed with Caution.</p>

        <div className={dangerInset}>
          {!isAccountDeletionScheduled ? (
            <>
              <h4 className={dangerH4}>Delete Account</h4>
              <p className={dangerBody}>
                Permanently delete your CrewRules™ account and associated personal data. Your account will be scheduled
                for deletion and can be restored within 30 days.
              </p>
              <button
                type="button"
                disabled={deletionPending}
                className={deletePrimaryBtn}
                onClick={() => {
                  setDeletionMessage(null);
                  setDeleteConfirmInput("");
                  setDeletionReasonDraft("");
                  setDeleteConfirmModalOpen(true);
                }}
              >
                Delete My Account
              </button>
            </>
          ) : (
            <>
              <h4 className={dangerH4}>Account Scheduled for Deletion</h4>
              <p className={dangerBody}>
                Your CrewRules™ account is scheduled for deletion. You can restore it before the scheduled deletion date.
              </p>
              {scheduledDeletionLabel && (
                <p className={scheduledRow}>
                  Scheduled deletion:{" "}
                  <span className={scheduledDate}>{scheduledDeletionLabel}</span>
                </p>
              )}
              {deletionReasonScheduled?.trim() ? (
                <p className={reasonLead}>
                  <span className={reasonStrong}>Your note: </span>
                  <span className="whitespace-pre-wrap">{deletionReasonScheduled.trim()}</span>
                </p>
              ) : null}
              <button
                type="button"
                disabled={deletionPending}
                className={restoreBtn}
                onClick={async () => {
                  setDeletionMessage(null);
                  setDeletionPending(true);
                  const result = await cancelScheduledAccountDeletion();
                  setDeletionPending(false);
                  if ("error" in result && result.error) {
                    setDeletionMessage({ type: "error", text: result.error });
                    return;
                  }
                  router.refresh();
                  if ("notScheduled" in result && result.notScheduled) {
                    setDeletionMessage({ type: "success", text: "No scheduled deletion was active." });
                  } else {
                    setDeletionMessage({ type: "success", text: "Your account has been restored." });
                  }
                }}
              >
                {deletionPending ? "Restoring…" : "Restore Account"}
              </button>
            </>
          )}
          {deletionMessage && (
            <p
              className={`mt-3 text-sm font-medium ${
                deletionMessage.type === "success"
                  ? isLightAdmin
                    ? "text-emerald-800"
                    : "text-emerald-800 dark:text-emerald-300"
                  : isLightAdmin
                    ? "text-red-700"
                    : "text-red-700 dark:text-red-400"
              }`}
            >
              {deletionMessage.text}
            </p>
          )}
        </div>
      </section>

      {deleteConfirmModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
        >
          {/* Backdrop: no click-to-dismiss (use Cancel) */}
          <div
            className="absolute inset-0"
            aria-hidden
          />
          <div
            className={modalDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-delete-confirm-title"
          >
            <h2 id="account-delete-confirm-title" className={modalTitle}>
              Delete Account?
            </h2>
            <div className={modalBody}>
              <p>
                Are you sure you want to schedule your CrewRules™ account for deletion? You will have 30 days to
                restore your account before permanent deletion.
              </p>
              <p className={modalFine}>
                Changed airlines? You may want to switch your account instead of deleting it.
              </p>
              <p className={modalFine}>
                Have a Pro plan? You can downgrade to Free instead of deleting your account.
              </p>
            </div>
            <div className="mt-4">
              <label htmlFor="account-delete-confirm-input" className={modalLabel}>
                Type DELETE to confirm
              </label>
              <input
                id="account-delete-confirm-input"
                type="text"
                name="delete_confirm"
                autoComplete="off"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                className={modalConfirmInput}
                placeholder="DELETE"
                aria-invalid={deleteConfirmInput.length > 0 && !deleteConfirmEnabled}
              />
            </div>
            <div className={modalFooterRule}>
              <button
                type="button"
                disabled={deletionPending}
                onClick={closeDeleteConfirmModal}
                className={modalCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletionPending || !deleteConfirmEnabled}
                className={modalDelete}
                onClick={async () => {
                  setDeletionMessage(null);
                  setDeletionPending(true);
                  const result = await scheduleAccountDeletion(
                    deletionReasonDraft.trim() ? deletionReasonDraft : undefined
                  );
                  setDeletionPending(false);
                  if ("error" in result && result.error) {
                    setDeletionMessage({ type: "error", text: result.error });
                    closeDeleteConfirmModal();
                    return;
                  }
                  closeDeleteConfirmModal();
                  if ("alreadyScheduled" in result && result.alreadyScheduled) {
                    router.refresh();
                    return;
                  }
                  router.refresh();
                  setDeletionMessage({ type: "success", text: "Your account is scheduled for deletion." });
                }}
              >
                {deletionPending ? "Scheduling…" : "Schedule Deletion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
