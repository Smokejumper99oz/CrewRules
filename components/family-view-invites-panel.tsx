"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Mail, Users } from "lucide-react";
import {
  createFamilyViewInvite,
  listFamilyViewInvites,
  revokeFamilyViewInvite,
  type FamilyViewInviteListItem,
} from "@/app/frontier/pilots/portal/profile/actions";
import { useRouter } from "next/navigation";

type SendState =
  | { type: "idle" }
  | { type: "success"; email: string }
  | { type: "warning"; email: string; detail: string }
  | { type: "error"; message: string };

type Props = {
  proActive: boolean;
};

/**
 * Live Family View invite UI: email input, send, success/warning/error states,
 * pending invite list with revoke. Replaces the preview-only block.
 */
export function FamilyViewInvitesPanel({ proActive }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [emailInput, setEmailInput] = useState("");
  const [sendState, setSendState] = useState<SendState>({ type: "idle" });
  const [invites, setInvites] = useState<FamilyViewInviteListItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    setListError(null);
    const res = await listFamilyViewInvites();
    if ("error" in res) {
      setListError(res.error);
      setInvites([]);
      return;
    }
    setInvites(res.invites);
  }, []);

  useEffect(() => {
    void fetchInvites();
  }, [fetchInvites]);

  const onSubmit = () => {
    const email = emailInput.trim();
    if (!email) return;
    setSendState({ type: "idle" });
    setRevokeError(null);
    startTransition(async () => {
      const res = await createFamilyViewInvite(email);
      if ("error" in res) {
        setSendState({ type: "error", message: res.error });
        return;
      }
      if (res.emailWarning) {
        setSendState({ type: "warning", email: res.invite.email, detail: res.emailWarning });
      } else {
        setSendState({ type: "success", email: res.invite.email });
      }
      setEmailInput("");
      await fetchInvites();
      router.refresh();
    });
  };

  const onRevoke = (id: string) => {
    setRevokeError(null);
    setSendState({ type: "idle" });
    startTransition(async () => {
      const res = await revokeFamilyViewInvite(id);
      if ("error" in res) {
        setRevokeError(res.error);
        return;
      }
      await fetchInvites();
      router.refresh();
    });
  };

  const pendingInvites = invites.filter((i) => i.status === "pending");

  return (
    <div className="space-y-6">
      {/* Pending invite list */}
      {listError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          Could not load invites: {listError}
        </p>
      ) : pendingInvites.length === 0 ? (
        <div className="flex gap-4 rounded-xl border border-slate-200/80 bg-white/75 px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)] sm:px-5 sm:py-5 dark:border-white/10 dark:bg-slate-900/35 dark:shadow-none">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 shadow-[inset_0_1px_1px_rgba(0,0,0,0.04)] dark:bg-slate-800/90 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]"
            aria-hidden
          >
            <Users className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">No shared viewers yet</p>
            <p className="mt-1.5 text-pretty text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Add a family member below and they will receive an email with a private link to view your schedule.
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {pendingInvites.map((inv) => (
            <li
              key={inv.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-3 shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-slate-900/45 dark:shadow-none"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
                <span className="text-sm text-slate-800 [overflow-wrap:anywhere] dark:text-slate-200">
                  {inv.email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRevoke(inv.id)}
                disabled={isPending}
                className="shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}

      {revokeError && (
        <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          Could not revoke: {revokeError}
        </p>
      )}

      {/* Invite form */}
      <div className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-white/90 via-slate-50/50 to-slate-50/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] sm:p-5 dark:border-white/10 dark:from-slate-900/50 dark:via-slate-950/40 dark:to-slate-950/60 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <h4 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
          Add a family member
        </h4>
        <p className="mt-1.5 max-w-prose text-pretty text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          They&apos;ll receive an email with a private link to view your schedule. The link expires in 30 days and can be
          revoked at any time.
        </p>

        <div className="mt-4 space-y-2">
          <label htmlFor="fv-invite-email" className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Email
          </label>
          <input
            id="fv-invite-email"
            type="email"
            value={emailInput}
            onChange={(e) => {
              setEmailInput(e.target.value);
              setSendState({ type: "idle" });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit();
            }}
            placeholder="family@example.com"
            disabled={isPending || !proActive}
            autoComplete="email"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#75C043] focus:outline-none focus:ring-2 focus:ring-[#75C043]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={isPending || !emailInput.trim() || !proActive}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#75C043] px-4 py-2 text-sm font-semibold text-[#0f172a] hover:bg-[#68ad3a] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#82cc50]"
          >
            {isPending ? "Sending…" : "Send Invite"}
          </button>
          {!proActive && (
            <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Available with CrewRules™ Pro
            </p>
          )}
        </div>

        {/* Send result feedback */}
        {sendState.type === "success" && (
          <div
            className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-800/40 dark:bg-emerald-950/30"
            role="status"
          >
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Invite sent to <span className="[overflow-wrap:anywhere]">{sendState.email}</span>
            </p>
          </div>
        )}
        {sendState.type === "warning" && (
          <div
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800/40 dark:bg-amber-950/30"
            role="alert"
          >
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
              Invite created for <span className="[overflow-wrap:anywhere]">{sendState.email}</span> — but the email
              could not be sent. Share the link manually or try again.
            </p>
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{sendState.detail}</p>
          </div>
        )}
        {sendState.type === "error" && (
          <div
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-800/40 dark:bg-red-950/30"
            role="alert"
          >
            <p className="text-xs font-medium text-red-700 dark:text-red-300">{sendState.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
