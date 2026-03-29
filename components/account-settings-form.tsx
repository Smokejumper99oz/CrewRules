"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  updatePassword,
  scheduleAccountDeletion,
  cancelScheduledAccountDeletion,
} from "@/app/frontier/pilots/portal/profile/actions";

type Props = {
  email: string | null;
  /** True when soft-delete has been scheduled (or timestamps partially set). */
  isAccountDeletionScheduled: boolean;
  /** ISO timestamp for final deletion; shown in scheduled state. */
  deletionScheduledFor: string | null;
  /** User-provided reason saved when deletion was scheduled. */
  deletionReasonScheduled?: string | null;
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
}: Props) {
  const router = useRouter();
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

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6 dark:border-white/5 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-900/60 dark:to-slate-950/80 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="mb-6 border-b border-slate-200 pb-4 dark:border-white/10">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug text-slate-900 sm:text-lg dark:text-white">Account</h2>
          <p className="mt-1 text-pretty text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400">
            Sign-in, security, password, and account-level controls.
          </p>
        </div>
      </div>

      <section
        className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]"
        aria-labelledby="account-sign-in-heading"
      >
        <div className="border-b border-slate-200/80 pb-3 dark:border-white/10">
          <h3
            id="account-sign-in-heading"
            className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white"
          >
            Sign-in
          </h3>
        </div>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Email address for your CrewRules™ account.
        </p>
        <div className="mt-4 rounded-lg border border-slate-200/80 bg-white/80 px-4 py-3 space-y-3 dark:border-white/10 dark:bg-slate-900/35">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Email</span>
            <p className="text-sm text-slate-900 [overflow-wrap:anywhere] dark:text-slate-100">{email ?? "—"}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Email is managed by CrewRules™ based on your airline access and cannot be edited.
            </p>
          </div>
        </div>
      </section>

      <section
        className="mt-6 rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]"
        aria-labelledby="account-security-heading"
      >
        <div className="border-b border-slate-200/80 pb-3 dark:border-white/10">
          <h3
            id="account-security-heading"
            className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white"
          >
            Security
          </h3>
        </div>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Password and sign-in security for your CrewRules™ account.
        </p>
        <div className="mt-4 rounded-lg border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-slate-900/35">
          <button
            type="button"
            onClick={() => {
              setShowChangePassword(!showChangePassword);
              setPasswordMessage(null);
            }}
            className="text-sm font-medium text-[#75C043] hover:text-[#75C043]/80"
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
                <label htmlFor="settings_new_password" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
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
                  className="mt-1 w-full max-w-xs profile-input-base"
                />
              </div>
              <div>
                <label htmlFor="settings_confirm_password" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
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
                  className="mt-1 w-full max-w-xs profile-input-base"
                />
              </div>
              {passwordMessage && (
                <p className={`text-sm ${passwordMessage.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {passwordMessage.text}
                </p>
              )}
              <button
                type="submit"
                disabled={passwordSaving}
                className="rounded-lg bg-[#75C043] px-3 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-95 disabled:opacity-50"
              >
                {passwordSaving ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </section>

      <section
        className="mt-6 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4 sm:p-5 dark:border-red-500/35 dark:bg-red-950/25"
        aria-labelledby="account-danger-heading"
      >
        <div className="border-b border-red-500/20 pb-3 dark:border-red-500/25">
          <h3 id="account-danger-heading" className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            Danger Zone
          </h3>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          Irreversible actions — proceed with caution.
        </p>

        <div className="mt-4 rounded-lg border border-red-500/20 bg-white/90 px-4 py-4 dark:border-red-500/30 dark:bg-slate-950/60">
          {!isAccountDeletionScheduled ? (
            <>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Delete Account</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Permanently delete your CrewRules™ account and associated personal data. Your account will be scheduled
                for deletion and can be restored within 30 days.
              </p>
              <button
                type="button"
                disabled={deletionPending}
                className="mt-4 rounded-lg border border-red-500/50 bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 dark:border-red-500/40 dark:bg-red-700 dark:hover:bg-red-600"
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
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Account Scheduled for Deletion</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Your CrewRules™ account is scheduled for deletion. You can restore it before the scheduled deletion date.
              </p>
              {scheduledDeletionLabel && (
                <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                  Scheduled deletion:{" "}
                  <span className="font-semibold text-red-700 dark:text-red-300">{scheduledDeletionLabel}</span>
                </p>
              )}
              {deletionReasonScheduled?.trim() ? (
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  <span className="font-medium text-slate-800 dark:text-slate-200">Your note: </span>
                  <span className="whitespace-pre-wrap">{deletionReasonScheduled.trim()}</span>
                </p>
              ) : null}
              <button
                type="button"
                disabled={deletionPending}
                className="mt-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
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
              className={`mt-3 text-sm ${deletionMessage.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
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
            className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-5 dark:border-white/10 dark:bg-slate-950 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-delete-confirm-title"
          >
            <h2
              id="account-delete-confirm-title"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Delete Account?
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              <p>
                Are you sure you want to schedule your CrewRules™ account for deletion? You will have 30 days to
                restore your account before permanent deletion.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                Changed airlines? You may want to switch your account instead of deleting it.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                Have a Pro plan? You can downgrade to Free instead of deleting your account.
              </p>
            </div>
            <div className="mt-4">
              <label htmlFor="account-delete-confirm-input" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Type DELETE to confirm
              </label>
              <input
                id="account-delete-confirm-input"
                type="text"
                name="delete_confirm"
                autoComplete="off"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                className="mt-1 w-full profile-input-base"
                placeholder="DELETE"
                aria-invalid={deleteConfirmInput.length > 0 && !deleteConfirmEnabled}
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
              <button
                type="button"
                disabled={deletionPending}
                onClick={closeDeleteConfirmModal}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletionPending || !deleteConfirmEnabled}
                className="rounded-lg border border-red-500/50 bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 dark:border-red-500/40 dark:bg-red-700 dark:hover:bg-red-600"
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
