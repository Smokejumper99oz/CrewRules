"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  createFamilyViewInvite,
  listFamilyViewInvites,
  revokeFamilyViewInvite,
  type FamilyViewInviteListItem,
} from "@/app/frontier/pilots/portal/profile/actions";
import { useRouter } from "next/navigation";

/**
 * Internal-only: create/list/revoke Family View invites and inspect raw tokens.
 * Render only when the server passes showInternalInviteTestPanel (dev or CREWRULES_FAMILY_VIEW_INVITES_TEST).
 */
export function FamilyViewInvitesInternalTestPanel() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<FamilyViewInviteListItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastRawToken, setLastRawToken] = useState<string | null>(null);

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

  const onCreate = () => {
    setActionError(null);
    setLastRawToken(null);
    startTransition(async () => {
      const res = await createFamilyViewInvite(email);
      if ("error" in res) {
        setActionError(res.error);
        return;
      }
      setLastRawToken(res.invite.rawToken);
      setEmail("");
      await fetchInvites();
      router.refresh();
    });
  };

  const onRevoke = (id: string) => {
    setActionError(null);
    startTransition(async () => {
      const res = await revokeFamilyViewInvite(id);
      if ("error" in res) {
        setActionError(res.error);
        return;
      }
      await fetchInvites();
      router.refresh();
    });
  };

  return (
    <section
      className="mt-8 rounded-xl border-2 border-dashed border-amber-500/50 bg-amber-50/80 p-4 sm:p-5 dark:border-amber-500/40 dark:bg-amber-950/25"
      aria-label="Internal Family View invites test tools"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200/90">
        Internal testing only
      </p>
      <p className="mt-1 text-pretty text-xs leading-relaxed text-amber-900/90 dark:text-amber-100/80">
        This panel is hidden unless the server runs in{" "}
        <code className="rounded bg-amber-100/90 px-1 py-0.5 text-[11px] dark:bg-amber-900/50">development</code> or sets{" "}
        <code className="rounded bg-amber-100/90 px-1 py-0.5 text-[11px] dark:bg-amber-900/50">
          CREWRULES_FAMILY_VIEW_INVITES_TEST=1
        </code>
        . No email is sent; raw token is for manual verification only.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Invite email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={isPending}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
        <button
          type="button"
          onClick={onCreate}
          disabled={isPending || !email.trim()}
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-700 dark:hover:bg-amber-600"
        >
          {isPending ? "Working…" : "Create / rotate invite"}
        </button>
      </div>

      {actionError ? (
        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          {actionError}
        </p>
      ) : null}
      {listError ? (
        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          {listError}
        </p>
      ) : null}

      {lastRawToken ? (
        <div className="mt-4 rounded-lg border border-amber-200/80 bg-white/90 p-3 dark:border-amber-800/50 dark:bg-slate-900/60">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Last raw token (not stored in DB)</p>
          <pre className="mt-2 max-h-32 overflow-auto break-all text-[11px] leading-snug text-slate-800 dark:text-slate-200">
            {lastRawToken}
          </pre>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Your invites</h4>
        <button
          type="button"
          onClick={() => startTransition(() => void fetchInvites())}
          disabled={isPending}
          className="text-xs font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-200"
        >
          Refresh list
        </button>
      </div>

      {invites.length === 0 ? (
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">No invites yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {invites.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-200/90 bg-white/90 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900/50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 [overflow-wrap:anywhere]">
                <span className="font-medium text-slate-900 dark:text-slate-100">{inv.email}</span>
                <span className="mx-2 text-slate-400">·</span>
                <span className="text-slate-600 dark:text-slate-400">{inv.status}</span>
                <div className="mt-0.5 text-slate-500 dark:text-slate-500">
                  expires {new Date(inv.expires_at).toLocaleString()}
                  {inv.revoked_at ? ` · revoked ${new Date(inv.revoked_at).toLocaleString()}` : null}
                </div>
              </div>
              {inv.status === "pending" ? (
                <button
                  type="button"
                  onClick={() => onRevoke(inv.id)}
                  disabled={isPending}
                  className="shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  Revoke
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
