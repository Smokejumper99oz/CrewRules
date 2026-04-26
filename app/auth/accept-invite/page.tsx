import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitAcceptInvite } from "./actions";

interface Props {
  searchParams: Promise<{ id?: string }>;
}

async function lookupInvite(id: string | undefined) {
  if (!id) return { status: "missing" as const };

  try {
    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("tenant_admin_invite_tokens")
      .select("id, email, used_at, expires_at")
      .eq("id", id)
      .single();

    if (error || !row) return { status: "not_found" as const };
    if (row.used_at) return { status: "used" as const };
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return { status: "expired" as const };
    }

    return { status: "valid" as const, email: row.email as string, id: row.id as string };
  } catch {
    return { status: "not_found" as const };
  }
}

export default async function AuthAcceptInvitePage({ searchParams }: Props) {
  const { id } = await searchParams;
  const invite = await lookupInvite(id);

  const errorMessage =
    invite.status === "missing" || invite.status === "not_found"
      ? "This invite link is invalid. Please ask your admin to send a new invite."
      : invite.status === "used"
        ? "This invite has already been used. If you need access, ask your admin to send a new invite."
        : invite.status === "expired"
          ? "This invite has expired. Please ask your admin to send a new invite."
          : null;

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-lg px-6 py-16">
          <div className="rounded-3xl border border-white/5 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-8 shadow-lg shadow-black/30">
            <h1 className="text-2xl font-bold tracking-tight text-rose-200">
              Invite invalid or expired
            </h1>
            <p className="mt-3 text-slate-300">{errorMessage}</p>
            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm text-slate-300 hover:text-white">
                ← Back to login
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const inviteId = (invite as { status: "valid"; email: string; id: string }).id;
  const inviteEmail = (invite as { status: "valid"; email: string; id: string }).email;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-white/5 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-8 shadow-lg shadow-black/30">
          <div className="text-xs uppercase tracking-widest text-slate-400">CrewRules™</div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Crew<span className="text-[#75C043]">Rules</span>
            <span className="align-super text-sm">™</span>
          </h1>
          <p className="mt-3 text-slate-300">
            You&apos;ve been invited to finish setting up your account.
          </p>
          {inviteEmail ? (
            <p className="mt-2 text-sm text-slate-400">
              Invite sent to: <span className="text-slate-200">{inviteEmail}</span>
            </p>
          ) : null}
          <p className="mt-4 text-slate-300">Click the button below to continue and set your password.</p>

          <form action={submitAcceptInvite} className="mt-8">
            <input type="hidden" name="invite_id" value={inviteId} />
            <button
              type="submit"
              className="block w-full rounded-xl bg-[#75C043] px-4 py-3 text-center text-sm font-semibold text-slate-950 transition hover:opacity-95"
            >
              Accept Invite
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-slate-300 hover:text-white">
              ← Back to login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
